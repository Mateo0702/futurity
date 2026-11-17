"""
Módulo de normalización y estandarización de nombres de equipos (Routers y ONTs)
para Futurity / Atlas.
Evita duplicidades por mayúsculas/minúsculas, variantes de redacción o espacios.
"""

CATALOGO_ROUTERS_OFICIAL = [
    # Modelos Homologados Wi-Fi 6
    "Router TPLink EX511",
    "Router Huawei AX3",
    "Router Huawei AX3S",
    "Router Huawei AX2",
    "ONT TPLink EXX530v",
    "ONT TPLink EXX231v",
    "Router Mercusys MR70X",
    "Router TPLink Archer AX10",
    "Router TPLink Archer AX12",
    "Router TPLink Archer AX53",
    "TPLINK WIFI 6",
    
    # Modelos Wi-Fi AC / Doble Banda
    "Router TPLink Archer C50",
    "Router TPLink Archer C64",
    "Router TPLink Archer C80",
    "Router TPLink Archer C60",
    "Router TPLink Archer C20",
    "Router TPLink Archer C24",
    "Router TPLink EC225-G5",
    "Router TPLink EC220-G5",
    "Router TPLink HC220-G5",
    "Router Cudy WR1300",
    "Router Cudy X6",
    "Router Cudy M4 Mesh",
    "Deco TPLink M4",
    "Deco TPLink X50",
    "Deco TPLink E4",
    "Deco TPLink XE75",
    "Router Reyee RG-EW1200",
    "Router Mercusys MR50G",
    "Router Mercusys MW330HP",
    "Router C-DATA WR525G",
    "Router Nexxt ARN02304U6",

    # Modelos Single Band / Legados
    "Router TPLink TL-WR840N",
    "Router TPLink TL-WR940N",
    "Router TPLink TL-WR850N",
    "Router TPLink TL-WR740N",
    "Router TPLink EX141",
    "Router TPLink XN020-G3v",
    "Router Mikrotik",
    "Router Cisco",
    "Router Tenda",
    "Router Ruijie",
    
    # Accesorios y Genéricos
    "Repetidor Wi-Fi",
    "WIFI ONT",
    "CABLE",
    "OTROS"
]

CATALOGO_ONTS_OFICIAL = [
    "HUAWEI",
    "KINGTYPE",
    "CDATA INTERNET",
    "CDATA COMBO",
    "CDATA-1FE-BRIDGE",
    "XX530v",
    "XX231v",
    "XPON",
    "VSOL",
    "ZTE",
    "TENDA",
    "ALT",
    "SUPREME",
    "XZ000-G7",
    "XN020-G3v",
    "ZHIYI",
    "FD511G-X-F690",
    "RADIO",
    "OTROS"
]

def normalizar_modelo_router(nombre):
    """
    Convierte cualquier variante de texto a la denominación canónica oficial.
    Elimina discrepancias como 'c50' vs 'C50', 'HUAWEI AX3' vs 'Router Huawei AX3', etc.
    """
    if not nombre:
        return ""
    s = str(nombre).strip()
    u = s.upper()

    # Placeholders y valores no válidos
    if u in ('SIN DATOS', 'NO ASIGNADA', 'SIN INFO', 'N/D', 'NONE', 'NULL', 'NO INSTALADO', 'POR INSTALAR', 'AUDITAR', 'F', '??????', 'R', 'ELEMENTO CHINO NO IDENTIFICADO'):
        return ""
    if u == 'CABLE':
        return 'CABLE'
    if u in ('WIFI ONT', 'ONT'):
        return 'WIFI ONT'

    # EX511 (modelo estrella)
    if 'EX511' in u:
        return 'Router TPLink EX511'
    # EXX530v / XX530v
    if '530' in u:
        return 'ONT TPLink EXX530v'
    # EXX231v / XX231v
    if '231' in u:
        return 'ONT TPLink EXX231v'

    # Huawei AX3S
    if 'AX3S' in u:
        return 'Router Huawei AX3S'
    # Huawei AX3
    if 'AX3' in u:
        return 'Router Huawei AX3'
    # Huawei AX2
    if 'AX2' in u:
        return 'Router Huawei AX2'

    # Archer C50 (unificación c50 vs C50)
    if 'C50' in u or 'C 50' in u:
        return 'Router TPLink Archer C50'
    # Archer C64
    if 'C64' in u:
        return 'Router TPLink Archer C64'
    # Archer C80
    if 'C80' in u:
        return 'Router TPLink Archer C80'
    # Archer C60
    if 'C60' in u:
        return 'Router TPLink Archer C60'
    # Archer C20
    if 'C20' in u:
        return 'Router TPLink Archer C20'
    # Archer C24
    if 'C24' in u:
        return 'Router TPLink Archer C24'
    # Archer AX10
    if 'AX10' in u:
        return 'Router TPLink Archer AX10'
    # Archer AX12
    if 'AX12' in u:
        return 'Router TPLink Archer AX12'
    # Archer AX53
    if 'AX53' in u:
        return 'Router TPLink Archer AX53'

    # Mercusys MR70X
    if 'MR70X' in u or ('MERCUSYS' in u and 'WIFI 6' in u):
        return 'Router Mercusys MR70X'
    if 'MR50G' in u:
        return 'Router Mercusys MR50G'
    if 'MW330HP' in u:
        return 'Router Mercusys MW330HP'

    # Cudy
    if 'CUDY' in u:
        if 'M4' in u or 'MESH' in u or 'PACK 2' in u:
            return 'Router Cudy M4 Mesh'
        if 'WR1300' in u:
            return 'Router Cudy WR1300'
        if 'X6' in u:
            return 'Router Cudy X6'
        return 'Router Cudy WR1300'

    # Deco TP-Link
    if 'DECO' in u:
        if 'M4' in u: return 'Deco TPLink M4'
        if 'E4' in u: return 'Deco TPLink E4'
        if 'XE75' in u: return 'Deco TPLink XE75'
        if 'X50' in u: return 'Deco TPLink X50'
        if 'X25' in u: return 'Deco TPLink X25'
        if 'M5' in u: return 'Deco TPLink M5'
        return 'Deco TPLink M4'

    # TL-WR840N / 840n
    if '840' in u:
        return 'Router TPLink TL-WR840N'
    # TL-WR940N / 940n
    if '940' in u:
        return 'Router TPLink TL-WR940N'
    # TL-WR850N
    if '850' in u and 'RE' not in u and 'ND' not in u:
        return 'Router TPLink TL-WR850N'
    # TL-WR740N
    if '740' in u:
        return 'Router TPLink TL-WR740N'

    # EC225-G5
    if 'EC225' in u:
        return 'Router TPLink EC225-G5'
    # EC220-G5
    if 'EC220' in u:
        return 'Router TPLink EC220-G5'
    # HC220-G5
    if 'HC220' in u:
        return 'Router TPLink HC220-G5'
    # EX141
    if 'EX141' in u:
        return 'Router TPLink EX141'
    # XN020
    if 'XN020' in u:
        return 'Router TPLink XN020-G3v'

    # Mikrotik
    if 'MIKROTIK' in u or 'ROUTERBOARD' in u:
        return 'Router Mikrotik'

    # TPLINK WIFI 6
    if 'TPLINK' in u and 'WIFI 6' in u:
        return 'TPLINK WIFI 6'

    # Repetidores / Extensores
    if any(k in u for k in ['REPETIDOR', 'EXTENSOR', 'WA850RE', 'WA855RE', 'WA830RE', 'RE200', 'RE205', 'XIAOMI REPEATER']):
        return 'Repetidor Wi-Fi'

    # C-DATA
    if 'CDATA' in u or 'C-DATA' in u:
        return 'Router C-DATA WR525G'

    # Reyee
    if 'REYEE' in u or 'RG-EW1200' in u:
        return 'Router Reyee RG-EW1200'

    # Nexxt
    if 'NEXXT' in u:
        return 'Router Nexxt ARN02304U6'

    # Cisco
    if 'CISCO' in u:
        return 'Router Cisco'

    # Tenda
    if 'TENDA' in u:
        return 'Router Tenda'

    # Ruijie
    if 'RUJIE' in u or 'RUIJIE' in u:
        return 'Router Ruijie'

    # Si coincide exactamente con alguno oficial ignorando mayúsculas
    for oficial in CATALOGO_ROUTERS_OFICIAL:
        if oficial.upper() == u:
            return oficial

    return s

def normalizar_modelo_ont(nombre):
    """
    Convierte cualquier variante de ONT a su denominación canónica.
    """
    if not nombre:
        return ""
    s = str(nombre).strip()
    u = s.upper()

    if u in ('SIN DATOS', 'NO ASIGNADA', 'SIN INFO', 'N/D', 'NONE', 'NULL', 'NO INSTALADO', 'POR INSTALAR', 'AUDITAR'):
        return ""

    if 'HUAWEI' in u: return 'HUAWEI'
    if 'KINGTYPE' in u: return 'KINGTYPE'
    if 'CDATA' in u:
        if 'COMBO' in u: return 'CDATA COMBO'
        if 'BRIDGE' in u or '1FE' in u: return 'CDATA-1FE-BRIDGE'
        return 'CDATA INTERNET'
    if '530' in u: return 'XX530v'
    if '231' in u: return 'XX231v'
    if 'XPON' in u: return 'XPON'
    if 'VSOL' in u: return 'VSOL'
    if 'ZTE' in u: return 'ZTE'
    if 'TENDA' in u: return 'TENDA'
    if 'ALT' in u: return 'ALT'
    if 'SUPREME' in u: return 'SUPREME'
    if 'XZ000' in u: return 'XZ000-G7'
    if 'XN020' in u: return 'XN020-G3v'
    if 'ZHIYI' in u: return 'ZHIYI'
    if 'FD511' in u: return 'FD511G-X-F690'
    if 'RADIO' in u: return 'RADIO'
    if 'SWITCH' in u: return 'SWITCH'

    for oficial in CATALOGO_ONTS_OFICIAL:
        if oficial.upper() == u:
            return oficial

    return s

