# SPDX-License-Identifier: MIT
"""Asset Library Bridge (asset_library_bridge)

The web UI's "Open in Blender" carries the library root + asset relative path into
Blender (stored on scene.assetlib). This add-on exposes three panels:

  * "Asset Library"   - the current asset's basic info (root / relative path / code / file name).
                        Draws nothing when no asset is bound, and offers a Clear button to unbind.
  * "Library Actions" - Update Preview (current viewport), Save to Library
  * "Model Tools"     - Reset Position to Origin (move the selected model back to 0,0,0)

Panel location: 3D View N sidebar -> "Asset Library".
"""
bl_info = {
    "name": "Asset Library Bridge",
    "author": "asset-browser",
    "version": (1, 2, 0),
    "blender": (4, 0, 0),
    "location": "View3D > Sidebar > Asset Library",
    "description": "View the current asset, update its preview, and save back to the library",
    "category": "Import-Export",
}

import bpy
import json
import os
import re
import shutil
from mathutils import Vector
from bpy.props import StringProperty, PointerProperty, IntProperty
from bpy.types import Operator, Panel, PropertyGroup, AddonPreferences


def _classify(name):
    n = name.lower()
    base = re.sub(r"\.(png|tga|tif|tiff|jpg|jpeg|bmp|exr|hdr|psd)$", "", n)
    toks = set(re.split(r"[_\-\s.]+", base))
    if toks & {"n", "normal", "nm", "norm"} or base.endswith(("_normal", "_nm", "_n")) or "nmap" in toks:
        return "normal"
    if "ao" in toks or base.endswith("_ao"):
        return "ao"
    if toks & {"height", "h", "disp"} or base.endswith("_height"):
        return "height"
    if toks & {"mask", "metallic", "roughness", "smoothness", "orm", "specular"} or base.endswith(("_mask", "_metallic", "_roughness", "_smoothness", "_orm")):
        return "mask"
    if toks & {"d", "diffuse", "albedo", "basecolor", "base", "color", "colour"} or base.endswith(("_d", "_diffuse", "_albedo", "_basecolor", "_a")):
        return "diffuse"
    return "other"


class AssetLibSettings(PropertyGroup):
    library_root: StringProperty(name="Library Root", subtype="DIR_PATH", default="D:\\3D Resource")
    asset_rel: StringProperty(name="Asset Path", default="")
    slug: StringProperty(name="File Name", default="")
    code: StringProperty(name="Code", default="")
    preview_size: IntProperty(name="Preview Size", description="Square preview edge in pixels", default=512, min=64, max=2048)


class AssetLibPreferences(AddonPreferences):
    bl_idname = __name__
    default_library_root: StringProperty(name="Default Library Root", subtype="DIR_PATH", default="D:\\3D Resource")

    def draw(self, context):
        self.layout.prop(self, "default_library_root")


def asset_dir(s):
    return os.path.join(s.library_root, s.asset_rel) if s.asset_rel else ""


def is_bound(s):
    return bool(s and s.asset_rel)


def ensure_asset(s):
    d = asset_dir(s)
    if not d or not os.path.isdir(d):
        raise RuntimeError("Asset path not found: %s (open from the web UI first, or set a valid root / relative path)" % d)
    return d


class ASSETLIB_OT_preview(Operator):
    bl_idname = "assetlib.update_preview"
    bl_label = "Update Preview"
    bl_description = "Write the current 3D viewport (as seen) to <asset>/<slug>.png"
    bl_options = {"REGISTER"}

    @classmethod
    def poll(cls, context):
        return is_bound(getattr(context.scene, "assetlib", None))

    def execute(self, context):
        s = context.scene.assetlib
        try:
            d = ensure_asset(s)
        except RuntimeError as e:
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}
        slug = s.slug or os.path.basename(d)
        out = os.path.join(d, slug + ".png")
        size = getattr(s, "preview_size", 512)
        r = context.scene.render
        saved = {
            "resolution_x": r.resolution_x,
            "resolution_y": r.resolution_y,
            "resolution_percentage": r.resolution_percentage,
            "pixel_aspect_x": r.pixel_aspect_x,
            "pixel_aspect_y": r.pixel_aspect_y,
            "file_format": r.image_settings.file_format,
            "filepath": r.filepath,
        }
        try:
            r.resolution_x = r.resolution_y = size
            r.resolution_percentage = 100
            r.pixel_aspect_x = r.pixel_aspect_y = 1.0
            r.image_settings.file_format = "PNG"
            r.filepath = out
            bpy.ops.render.opengl(write_still=True, view_context=True)
        except Exception as e:
            self.report({"ERROR"}, "Viewport capture failed (run from a 3D view): %s" % e)
            return {"CANCELLED"}
        finally:
            r.resolution_x = saved["resolution_x"]
            r.resolution_y = saved["resolution_y"]
            r.resolution_percentage = saved["resolution_percentage"]
            r.pixel_aspect_x = saved["pixel_aspect_x"]
            r.pixel_aspect_y = saved["pixel_aspect_y"]
            r.image_settings.file_format = saved["file_format"]
            r.filepath = saved["filepath"]
        self.report({"INFO"}, "Preview updated: %s" % out)
        return {"FINISHED"}


class ASSETLIB_OT_save(Operator):
    bl_idname = "assetlib.save_to_library"
    bl_label = "Save to Library"
    bl_description = "Export the FBX back to the library, move textures into _textures, and sync the json"
    bl_options = {"REGISTER"}

    @classmethod
    def poll(cls, context):
        return is_bound(getattr(context.scene, "assetlib", None))

    def execute(self, context):
        s = context.scene.assetlib
        try:
            d = ensure_asset(s)
        except RuntimeError as e:
            self.report({"ERROR"}, str(e)); return {"CANCELLED"}
        slug = s.slug or os.path.basename(d)
        lib = s.library_root
        l1 = (s.asset_rel.split("/")[0] if "/" in s.asset_rel else s.asset_rel) or "Misc"
        pool = os.path.join(lib, "_textures", l1)
        os.makedirs(pool, exist_ok=True)

        used = set()
        for o in context.scene.objects:
            if o.type != "MESH":
                continue
            for m in o.data.materials:
                if m and m.use_nodes:
                    for n in m.node_tree.nodes:
                        if n.type == "TEX_IMAGE" and n.image:
                            used.add(n.image.name)
        pool_real = os.path.realpath(os.path.join(lib, "_textures"))
        rel_tex = {}
        for img in list(bpy.data.images):
            if img.type != "IMAGE" or img.name not in used:
                continue
            src = os.path.realpath(bpy.path.abspath(img.filepath)) if img.filepath else ""
            if (not src or not os.path.exists(src)) and img.packed_file:
                dest = os.path.join(pool, (img.name or "packed") + ".png")
                img.filepath_raw = dest
                img.file_format = "PNG"
                img.save()
                src = os.path.realpath(dest)
            if not src or not os.path.exists(src):
                continue
            inside_pool = src == pool_real or src.startswith(pool_real + os.sep)
            if inside_pool:
                dest = src
            else:
                base = os.path.basename(src)
                dest = os.path.join(pool, base)
                if os.path.exists(dest) and os.path.getsize(dest) != os.path.getsize(src):
                    stem, ext = os.path.splitext(base)
                    dest = os.path.join(pool, "%s__%s%s" % (stem, abs(hash(src)) % 100000, ext))
                dest = os.path.realpath(dest)
                if os.path.normcase(src) != os.path.normcase(dest):
                    shutil.copy2(src, dest)
                img.filepath = dest
            rel = os.path.relpath(dest, lib).replace("\\", "/")
            rel_tex[rel] = os.path.basename(rel)

        fbx = os.path.join(d, slug + ".fbx")
        tmp_blend = os.path.join(d, "_assetlib_tmp.blend")
        bpy.ops.wm.save_as_mainfile(filepath=tmp_blend)
        # Pin units so the round-trip is neutral no matter what the scene's Unit Scale is
        # (export always x100; the bridge import always /100).
        bpy.ops.export_scene.fbx(filepath=fbx, path_mode="RELATIVE",
                                 object_types={"MESH"}, embed_textures=False,
                                 apply_unit_scale=False, global_scale=1.0)
        try:
            os.remove(tmp_blend)
        except OSError:
            pass

        mn = Vector((1e18,) * 3); mx = Vector((-1e18,) * 3); tris = 0; found = False
        for o in context.scene.objects:
            if o.type != "MESH":
                continue
            found = True
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                for i in range(3):
                    mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
            g = o.data
            tris += (len(g.loop_triangles) if g.loop_triangles else (len(g.polygons)))
        size = (mx - mn) if found else Vector((0, 0, 0))

        bykind = {}
        for rel in sorted(rel_tex):
            bykind.setdefault(_classify(rel_tex[rel]), []).append(rel)

        jf = os.path.join(d, slug + ".json")
        js = {}
        if os.path.exists(jf):
            try:
                js = json.load(open(jf, encoding="utf-8-sig"))
            except Exception:
                js = {}
        js["id"] = slug
        js["name"] = slug
        js["code"] = s.code or js.get("code", "")
        js["textures"] = sorted(rel_tex.keys())
        js["textures_by_kind"] = bykind
        js["texture_storage"] = "shared:_textures" if rel_tex else "none"
        js["dimensions_m"] = {"width": round(size.x, 3), "height": round(size.z, 3), "depth": round(size.y, 3)}
        js["tri_count"] = tris
        if not rel_tex:
            js["untextured"] = True
        else:
            js.pop("untextured", None)
        json.dump(js, open(jf, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

        at_path = os.path.join(lib, "_Catalog", "asset_textures.json")
        try:
            atlas = json.load(open(at_path, encoding="utf-8-sig"))
        except Exception:
            atlas = {}
        atlas[slug] = {"category": js.get("category"), "name_original": js.get("name_original"),
                       "textures": bykind, "count": len(rel_tex),
                       "texture_storage": js["texture_storage"]}
        json.dump(atlas, open(at_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

        self.report({"INFO"}, "Saved: %s (textures %d)" % (fbx, len(rel_tex)))
        return {"FINISHED"}


class ASSETLIB_OT_clear(Operator):
    bl_idname = "assetlib.clear"
    bl_label = "Clear"
    bl_description = "Unbind the current asset — the panel empties to show nothing is bound"
    bl_options = {"REGISTER", "INTERNAL"}

    def execute(self, context):
        s = context.scene.assetlib
        s.asset_rel = ""
        s.slug = ""
        s.code = ""
        self.report({"INFO"}, "Asset binding cleared")
        return {"FINISHED"}


class ASSETLIB_OT_reset_position(Operator):
    bl_idname = "assetlib.reset_position"
    bl_label = "Reset Position to Origin"
    bl_description = "Move the selected model(s) back to the world origin (0, 0, 0)"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return any(o.type == "MESH" for o in context.selected_objects)

    def execute(self, context):
        targets = [o for o in context.selected_objects if o.type == "MESH"]
        if not targets:
            self.report({"ERROR"}, "Select at least one mesh object first")
            return {"CANCELLED"}
        for o in targets:
            mw = o.matrix_world.copy()
            mw.translation = (0.0, 0.0, 0.0)
            o.matrix_world = mw
        context.view_layer.update()
        self.report({"INFO"}, "Reset %d object(s) to origin" % len(targets))
        return {"FINISHED"}


class ASSETLIB_PT_info(Panel):
    bl_label = "Asset Library"
    bl_idname = "ASSETLIB_PT_info"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Asset Library"
    bl_order = 0

    def draw(self, context):
        s = context.scene.assetlib
        if not is_bound(s):
            # Nothing bound: leave the panel empty (no asset info to show).
            return
        col = self.layout.column(align=True)
        col.prop(s, "library_root")
        col.prop(s, "asset_rel")
        row = col.row(align=True)
        row.prop(s, "code", text="")
        row.prop(s, "slug", text="")
        col.prop(s, "preview_size")
        self.layout.label(text="Asset: %s" % s.asset_rel, icon="FILE_FOLDER")
        self.layout.operator("assetlib.clear", icon="X")


class ASSETLIB_PT_actions(Panel):
    bl_label = "Library Actions"
    bl_idname = "ASSETLIB_PT_actions"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Asset Library"
    bl_order = 1

    def draw(self, context):
        c = self.layout.column(align=True)
        c.scale_y = 1.4
        c.operator("assetlib.update_preview", icon="RENDER_STILL")
        c.operator("assetlib.save_to_library", icon="EXPORT")


class ASSETLIB_PT_model_tools(Panel):
    bl_label = "Model Tools"
    bl_idname = "ASSETLIB_PT_model_tools"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Asset Library"
    bl_order = 2

    def draw(self, context):
        c = self.layout.column(align=True)
        c.scale_y = 1.4
        c.operator("assetlib.reset_position", icon="WORLD")


classes = (AssetLibSettings, AssetLibPreferences,
           ASSETLIB_OT_preview, ASSETLIB_OT_save, ASSETLIB_OT_clear,
           ASSETLIB_OT_reset_position,
           ASSETLIB_PT_info, ASSETLIB_PT_actions, ASSETLIB_PT_model_tools)


def register():
    if hasattr(bpy.types.Scene, "assetlib"):
        del bpy.types.Scene.assetlib
    for c in classes:
        bpy.utils.register_class(c)
    bpy.types.Scene.assetlib = PointerProperty(type=AssetLibSettings)


def unregister():
    if hasattr(bpy.types.Scene, "assetlib"):
        del bpy.types.Scene.assetlib
    for c in reversed(classes):
        bpy.utils.unregister_class(c)


if __name__ == "__main__":
    register()
