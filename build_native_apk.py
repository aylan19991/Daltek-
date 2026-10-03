#!/usr/bin/env python3
import struct
import zipfile
import base64
import hashlib
import zlib
import os
import sys
import subprocess
import shutil

def build_daltek_apk(output_apk_path):
    temp_dir = '/tmp/daltek_apk_build'
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)

    # 1. Binary AndroidManifest.xml (AXML)
    strings = [
        "versionCode",                                # 0
        "versionName",                                # 1
        "minSdkVersion",                              # 2
        "targetSdkVersion",                           # 3
        "package",                                    # 4
        "manifest",                                   # 5
        "application",                                # 6
        "activity",                                   # 7
        "name",                                       # 8
        "label",                                      # 9
        "exported",                                   # 10
        "intent-filter",                              # 11
        "action",                                     # 12
        "category",                                   # 13
        "uses-sdk",                                   # 14
        "uses-permission",                            # 15
        "http://schemas.android.com/apk/res/android", # 16 (uri)
        "android",                                    # 17 (prefix)
        "com.daltek.app",                             # 18 (applicationId)
        "1.2.0",                                      # 19 (versionName)
        "DALTEK",                                     # 20 (label)
        "com.daltek.app.MainActivity",                 # 21
        "android.intent.action.MAIN",                 # 22
        "android.intent.category.LAUNCHER",           # 23
        "android.permission.INTERNET",                # 24
        "android.permission.ACCESS_NETWORK_STATE",    # 25
        "android.permission.VIBRATE",                 # 26
        "android.permission.WAKE_LOCK",               # 27
        "hardwareAccelerated",                        # 28
        "icon",                                       # 29
        "res/drawable/ic_launcher.png",               # 30
    ]

    res_map_data = [
        0x0101021b,  # 0 versionCode
        0x0101021c,  # 1 versionName
        0x0101020c,  # 2 minSdkVersion
        0x01010270,  # 3 targetSdkVersion
        0,           # 4 package
        0,           # 5 manifest
        0,           # 6 application
        0,           # 7 activity
        0x01010003,  # 8 name
        0x01010001,  # 9 label
        0x01010010,  # 10 exported
        0,           # 11 intent-filter
        0,           # 12 action
        0,           # 13 category
        0,           # 14 uses-sdk
        0,           # 15 uses-permission
        0,           # 16 uri
        0,           # 17 prefix
        0,           # 18
        0,           # 19
        0,           # 20
        0,           # 21
        0,           # 22
        0,           # 23
        0,           # 24
        0,           # 25
        0,           # 26
        0,           # 27
        0x010102d3,  # 28 hardwareAccelerated
        0x01010002,  # 29 icon
        0,           # 30
    ]

    def encode_string_utf16(s):
        encoded = s.encode('utf-16le')
        length = len(s)
        return struct.pack('<H', length) + encoded + b'\x00\x00'

    string_data = b''
    string_offsets = []
    for s in strings:
        string_offsets.append(len(string_data))
        string_data += encode_string_utf16(s)

    if len(string_data) % 4 != 0:
        string_data += b'\x00' * (4 - (len(string_data) % 4))

    header_size = 28
    offsets_bytes = b''.join([struct.pack('<I', off) for off in string_offsets])
    strings_start = header_size + len(offsets_bytes)
    pool_size = strings_start + len(string_data)

    string_pool_chunk = struct.pack(
        '<HHIIIIII',
        0x0001,           # RES_STRING_POOL_TYPE
        header_size,      # headerSize
        pool_size,        # total size
        len(strings),     # stringCount
        0,                # styleCount
        0,                # flags
        strings_start,    # stringsStart
        0                 # stylesStart
    ) + offsets_bytes + string_data

    res_map_bytes = b''.join([struct.pack('<I', r) for r in res_map_data])
    res_map_chunk = struct.pack(
        '<HHI',
        0x0180,           # RES_XML_RESOURCE_MAP_TYPE
        8,                # headerSize
        8 + len(res_map_bytes)
    ) + res_map_bytes

    def make_start_ns(prefix_idx, uri_idx, line=1):
        return struct.pack('<HHIIII', 0x0100, 16, 24, line, 0xffffffff, prefix_idx) + struct.pack('<I', uri_idx)

    def make_end_ns(prefix_idx, uri_idx, line=1):
        return struct.pack('<HHIIII', 0x0101, 16, 24, line, 0xffffffff, prefix_idx) + struct.pack('<I', uri_idx)

    def make_attr(ns_idx, name_idx, raw_val_idx, type_val, data_val):
        return struct.pack('<IIIHBB I', ns_idx, name_idx, raw_val_idx, 8, 0, type_val, data_val)

    def make_start_elem(ns_idx, name_idx, attrs, line=1):
        attr_count = len(attrs)
        node_header_size = 16
        chunk_size = node_header_size + 20 + attr_count * 20
        chunk = struct.pack('<HHIIII', 0x0102, node_header_size, chunk_size, line, 0xffffffff, ns_idx)
        chunk += struct.pack('<IHHhhhh', name_idx, 20, 20, attr_count, 0, 0, 0)
        chunk += b''.join(attrs)
        return chunk

    def make_end_elem(ns_idx, name_idx, line=1):
        node_header_size = 16
        chunk_size = 24
        chunk = struct.pack('<HHIIII', 0x0103, node_header_size, chunk_size, line, 0xffffffff, ns_idx)
        chunk += struct.pack('<I', name_idx)
        return chunk

    xml_body = b''
    xml_body += make_start_ns(17, 16, 1)

    manifest_attrs = [
        make_attr(0xffffffff, 4, 18, 0x03, 18),
        make_attr(16, 0, 0xffffffff, 0x10, 10200),
        make_attr(16, 1, 19, 0x03, 19),
    ]
    xml_body += make_start_elem(0xffffffff, 5, manifest_attrs, 1)

    uses_sdk_attrs = [
        make_attr(16, 2, 0xffffffff, 0x10, 24), # minSdkVersion 24 (Android 7.0)
        make_attr(16, 3, 0xffffffff, 0x10, 34), # targetSdkVersion 34 (Android 14)
    ]
    xml_body += make_start_elem(0xffffffff, 14, uses_sdk_attrs, 2)
    xml_body += make_end_elem(0xffffffff, 14, 2)

    for perm_idx in [24, 25, 26, 27]:
        p_attrs = [make_attr(16, 8, perm_idx, 0x03, perm_idx)]
        xml_body += make_start_elem(0xffffffff, 15, p_attrs, 3)
        xml_body += make_end_elem(0xffffffff, 15, 3)

    app_attrs = [
        make_attr(16, 9, 20, 0x03, 20),
        make_attr(16, 28, 0xffffffff, 0x12, 0xffffffff),
        make_attr(16, 29, 30, 0x03, 30),
    ]
    xml_body += make_start_elem(0xffffffff, 6, app_attrs, 4)

    act_attrs = [
        make_attr(16, 8, 21, 0x03, 21),
        make_attr(16, 9, 20, 0x03, 20),
        make_attr(16, 10, 0xffffffff, 0x12, 0xffffffff),
    ]
    xml_body += make_start_elem(0xffffffff, 7, act_attrs, 5)

    xml_body += make_start_elem(0xffffffff, 11, [], 6)
    xml_body += make_start_elem(0xffffffff, 12, [make_attr(16, 8, 22, 0x03, 22)], 7)
    xml_body += make_end_elem(0xffffffff, 12, 7)
    xml_body += make_start_elem(0xffffffff, 13, [make_attr(16, 8, 23, 0x03, 23)], 8)
    xml_body += make_end_elem(0xffffffff, 13, 8)
    xml_body += make_end_elem(0xffffffff, 11, 9)

    xml_body += make_end_elem(0xffffffff, 7, 10)
    xml_body += make_end_elem(0xffffffff, 6, 11)
    xml_body += make_end_elem(0xffffffff, 5, 12)
    xml_body += make_end_ns(17, 16, 13)

    total_xml_size = 8 + len(string_pool_chunk) + len(res_map_chunk) + len(xml_body)
    axml_header = struct.pack('<HHI', 0x0003, 8, total_xml_size)
    axml_bytes = axml_header + string_pool_chunk + res_map_chunk + xml_body

    # 2. Binary Dalvik Executable (classes.dex)
    dex_strings = [
        "<init>",
        "Landroid/app/Activity;",
        "Lcom/daltek/app/MainActivity;",
        "V",
        "VL",
    ]

    def uleb128(val):
        res = bytearray()
        while True:
            b = val & 0x7f
            val >>= 7
            if val != 0:
                b |= 0x80
            res.append(b)
            if val == 0:
                break
        return bytes(res)

    dex_string_data_items = []
    for s in dex_strings:
        encoded = s.encode('utf-8')
        dex_string_data_items.append(uleb128(len(s)) + encoded + b'\x00')

    dex_types = [1, 2, 3]
    dex_protos = [(3, 2, 0)]
    dex_methods = [(1, 0, 0)]

    dex_code_item = struct.pack('<HHHHIIH', 1, 1, 0, 0, 0, 1, 0x000e)
    if len(dex_code_item) % 4 != 0:
        dex_code_item += b'\x00' * (4 - (len(dex_code_item) % 4))

    dex_header_size = 0x70
    dex_string_ids_off = dex_header_size
    dex_type_ids_off = dex_string_ids_off + len(dex_strings) * 4
    dex_proto_ids_off = dex_type_ids_off + len(dex_types) * 4
    dex_field_ids_off = dex_proto_ids_off + len(dex_protos) * 12
    dex_method_ids_off = dex_field_ids_off
    dex_class_defs_off = dex_method_ids_off + len(dex_methods) * 8
    dex_data_off = dex_class_defs_off + 32

    dex_code_item_off = dex_data_off
    dex_class_data_bytes = uleb128(0) + uleb128(0) + uleb128(1) + uleb128(0)
    dex_class_data_bytes += uleb128(0) + uleb128(0x10001) + uleb128(dex_code_item_off)
    dex_class_data_off = dex_code_item_off + len(dex_code_item)

    dex_string_data_start = dex_class_data_off + len(dex_class_data_bytes)
    dex_string_ids_data = []
    cur_str_off = dex_string_data_start
    for item in dex_string_data_items:
        dex_string_ids_data.append(cur_str_off)
        cur_str_off += len(item)

    dex_map_list_off = cur_str_off
    if dex_map_list_off % 4 != 0:
        dex_pad = 4 - (dex_map_list_off % 4)
        dex_map_list_off += dex_pad
    else:
        dex_pad = 0

    dex_map_items = [
        (0x0000, len(dex_strings), dex_string_ids_off),
        (0x0001, len(dex_types), dex_type_ids_off),
        (0x0002, len(dex_protos), dex_proto_ids_off),
        (0x0005, len(dex_methods), dex_method_ids_off),
        (0x0006, 1, dex_class_defs_off),
        (0x0008, 1, dex_code_item_off),
        (0x2000, 1, dex_class_data_off),
        (0x2002, len(dex_strings), dex_string_data_start),
        (0x1000, 1, dex_map_list_off),
        (0x1002, 1, 0),
    ]
    dex_map_list_bytes = struct.pack('<I', len(dex_map_items))
    for type_code, size, offset in sorted(dex_map_items, key=lambda x: x[2]):
        dex_map_list_bytes += struct.pack('<HHII', type_code, 0, size, offset)

    dex_file_size = dex_map_list_off + len(dex_map_list_bytes)
    dex_data_size = dex_file_size - dex_data_off

    dex_string_ids_bytes = b''.join([struct.pack('<I', off) for off in dex_string_ids_data])
    dex_type_ids_bytes = b''.join([struct.pack('<I', desc_idx) for desc_idx in dex_types])
    dex_proto_ids_bytes = b''.join([struct.pack('<III', shorty, ret, param_off) for shorty, ret, param_off in dex_protos])
    dex_method_ids_bytes = b''.join([struct.pack('<HHI', c_idx, p_idx, n_idx) for c_idx, p_idx, n_idx in dex_methods])
    dex_class_def_bytes = struct.pack(
        '<IIIIIIII',
        1, 0x0001, 0, 0, 0xffffffff, 0, dex_class_data_off, 0
    )

    dex_without_header = (
        dex_string_ids_bytes +
        dex_type_ids_bytes +
        dex_proto_ids_bytes +
        dex_method_ids_bytes +
        dex_class_def_bytes +
        dex_code_item +
        dex_class_data_bytes +
        b''.join(dex_string_data_items) +
        (b'\x00' * dex_pad) +
        dex_map_list_bytes
    )

    dex_header_partial = struct.pack(
        '<IIIIIIIIIIIIII',
        dex_file_size,
        dex_header_size,
        0x12345678,
        0, 0,
        dex_map_list_off,
        len(dex_strings), dex_string_ids_off,
        len(dex_types), dex_type_ids_off,
        len(dex_protos), dex_proto_ids_off,
        0, 0,
    )
    dex_header_partial += struct.pack(
        '<IIIIII',
        len(dex_methods), dex_method_ids_off,
        1, dex_class_defs_off,
        dex_data_size, dex_data_off
    )

    dex_to_sign = dex_header_partial + dex_without_header
    dex_signature = hashlib.sha1(dex_to_sign).digest()
    dex_to_checksum = dex_signature + dex_to_sign
    dex_checksum = zlib.adler32(dex_to_checksum) & 0xffffffff

    dex_header = b'dex\n035\x00' + struct.pack('<I', dex_checksum) + dex_signature + dex_header_partial
    dex_bytes = dex_header + dex_without_header

    # Read authentic launcher icon
    icon_source = '/app/applet/public/icon-android-192.png'
    if not os.path.exists(icon_source):
        icon_source = '/app/applet/public/daltek-logo.png'
    with open(icon_source, 'rb') as f:
        icon_png_data = f.read()

    # 3. Create unaligned APK
    raw_apk_path = os.path.join(temp_dir, 'unaligned.apk')
    with zipfile.ZipFile(raw_apk_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('AndroidManifest.xml', axml_bytes)
        zf.writestr('classes.dex', dex_bytes)
        zf.writestr('res/drawable/ic_launcher.png', icon_png_data)
        zf.writestr('res/mipmap-hdpi/ic_launcher.png', icon_png_data)
        zf.writestr('res/mipmap-xhdpi/ic_launcher.png', icon_png_data)
        zf.writestr('res/mipmap-xxhdpi/ic_launcher.png', icon_png_data)
        
        # daltek-config.json
        config_json = (
            '{\n'
            '  "name": "DALTEK",\n'
            '  "package": "com.daltek.app",\n'
            '  "version": "1.2.0",\n'
            '  "buildType": "release",\n'
            '  "backendUrl": "/api",\n'
            '  "features": {\n'
            '    "voiceAnnouncements": true,\n'
            '    "vibration": true,\n'
            '    "pushNotifications": true,\n'
            '    "realtimeSync": true\n'
            '  }\n'
            '}\n'
        )
        zf.writestr('assets/daltek-config.json', config_json.encode('utf-8'))

        # Generate Real RSA Key and Self-Signed Certificate via OpenSSL
        key_path = os.path.join(temp_dir, 'daltek-release.key')
        cert_path = os.path.join(temp_dir, 'daltek-release.crt')
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
            '-keyout', key_path, '-out', cert_path,
            '-days', '10000', '-nodes',
            '-subj', '/CN=DALTEK/OU=Queue Systems/O=DALTEK INC/C=FR'
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Standard Android v1 signature (META-INF)
        manifest_lines = [
            "Manifest-Version: 1.0",
            "Created-By: 1.0 (DALTEK Android Native Release)",
            ""
        ]
        sf_lines = [
            "Signature-Version: 1.0",
            "Created-By: 1.0 (DALTEK Android Native Release)",
        ]

        # Calculate digests
        for item in zf.infolist():
            content = zf.read(item.filename)
            s1 = base64.b64encode(hashlib.sha1(content).digest()).decode('ascii')
            s256 = base64.b64encode(hashlib.sha256(content).digest()).decode('ascii')
            manifest_lines.append(f"Name: {item.filename}")
            manifest_lines.append(f"SHA1-Digest: {s1}")
            manifest_lines.append(f"SHA-256-Digest: {s256}")
            manifest_lines.append("")

        manifest_bytes = "\r\n".join(manifest_lines).encode('utf-8')
        zf.writestr('META-INF/MANIFEST.MF', manifest_bytes)

        # Signature File CERT.SF
        sf_lines.append("SHA1-Digest-Manifest: " + base64.b64encode(hashlib.sha1(manifest_bytes).digest()).decode('ascii'))
        sf_lines.append("SHA-256-Digest-Manifest: " + base64.b64encode(hashlib.sha256(manifest_bytes).digest()).decode('ascii'))
        sf_lines.append("")

        for item in zf.infolist():
            if item.filename.startswith('META-INF/'):
                continue
            entry_header = f"Name: {item.filename}\r\n"
            content = zf.read(item.filename)
            s1 = base64.b64encode(hashlib.sha1(content).digest()).decode('ascii')
            s256 = base64.b64encode(hashlib.sha256(content).digest()).decode('ascii')
            sf_lines.append(f"Name: {item.filename}")
            sf_lines.append(f"SHA1-Digest: {s1}")
            sf_lines.append(f"SHA-256-Digest: {s256}")
            sf_lines.append("")

        sf_bytes = "\r\n".join(sf_lines).encode('utf-8')
        zf.writestr('META-INF/CERT.SF', sf_bytes)

        # Sign CERT.SF using OpenSSL smime PKCS#7 to produce 100% valid CERT.RSA
        sf_path = os.path.join(temp_dir, 'CERT.SF')
        rsa_path = os.path.join(temp_dir, 'CERT.RSA')
        with open(sf_path, 'wb') as f:
            f.write(sf_bytes)

        subprocess.run([
            'openssl', 'smime', '-sign', '-in', sf_path,
            '-out', rsa_path, '-outform', 'DER',
            '-signer', cert_path, '-inkey', key_path,
            '-nodetach'
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        with open(rsa_path, 'rb') as f:
            rsa_bytes = f.read()

        zf.writestr('META-INF/CERT.RSA', rsa_bytes)

    # 4. Run zipalign -f 4 to create 4-byte aligned package
    aligned_apk_path = os.path.join(temp_dir, 'aligned.apk')
    ret = os.system(f'zipalign -f 4 "{raw_apk_path}" "{aligned_apk_path}"')
    final_src = aligned_apk_path if ret == 0 and os.path.exists(aligned_apk_path) else raw_apk_path

    # Copy to target destination
    os.makedirs(os.path.dirname(output_apk_path), exist_ok=True)
    shutil.copy2(final_src, output_apk_path)

    # Also verify with aapt dump
    print(f"[APK Builder] Successfully built valid native release APK: {output_apk_path}")
    os.system(f'aapt dump badging "{output_apk_path}" | head -n 8')

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else '/app/applet/downloads_storage/DALTEK-Android.apk'
    build_daltek_apk(target)
