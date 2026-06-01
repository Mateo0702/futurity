CREATE DATABASE IF NOT EXISTS optimizador_rutas;
USE optimizador_rutas;

-- ====================================================================
-- 1. TABLAS DE SOPORTE Y CATÁLOGOS LOGÍSTICOS
-- ====================================================================

DROP TABLE IF EXISTS callcenter;
CREATE TABLE callcenter (
    id_asesor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO callcenter (nombre) VALUES 
('CC. Guissella Quezada'), 
('CC. Mateo Samaniego'), 
('CC. Luis Saenz');


DROP TABLE IF EXISTS tecnicos;
CREATE TABLE tecnicos (
    id_tecnico INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tecnicos (nombre) VALUES 
('TECNOLOGIA'), ('BRYAN G'), ('OSWALDO BERMEO'), ('EDUARDO CRUZ'), 
('DARWIN UYAGUARI'), ('JUAN DIEGO MAITA'), ('MILTON BERMEO'), 
('VICTOR ARIAS'), ('NO TECNICO'), ('BRYAM LOJANO'), ('ERICK LOJANO'), 
('ROMMEL'), ('HENRY CUENCA'), ('JOOEL ARROYO');


DROP TABLE IF EXISTS catalogo_problemas;
CREATE TABLE catalogo_problemas (
    id_problema INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO catalogo_problemas (nombre) VALUES 
('POTENCIA DEGRADADA (GPON)'), ('ENLACE INESTABLE (AFINAR ANTENA)'), ('ANTENA NO SE ENGACHA'), 
('CANALES BORROSOS'), ('INSTALAR ROUTER'), ('CONF. DE EQUIPO'), ('CONF. DE EQUIPO (VT COBRADA)'), 
('EQUIPO ALARMADO (LOS)'), ('ONT ENGANCHADA SIN SERVICIO (DESCONFIGURADO)'), ('INTERMITENCIAS EN EL SERVICIO'), 
('VERIFICAR COBERTURA WIFI'), ('NO MARCA VELOCIDAD CONTRATADA'), ('REUBICACION DE EQUIPOS'), 
('SIN SERVICIO DE CABLE'), ('INSTALACION NUEVA'), ('ROUTER NO DA INTERNET'), ('REVISION DE SERVICIO'), 
('REGISTRAR EQUIPOS'), ('LENTITUD EN EL SERVICIO'), ('ROUTER SIN CONEXION'), ('VERIFICAR INSTALACION'), 
('RETENCION'), ('CAMBIO DE FO'), ('RECONEXION'), ('REVISION DE ONT'), ('ACTUALIZACION DE EQUIPOS'), 
('CAMBIO DE ADAPTADOR'), ('AUTONEGOCIACIÓN INCORRECTA'), ('CAMBIO DE CABLE UTP'), ('COLOCAR ROUTER'), 
('DOMÓTICA'), ('VT COBRADA / MANIPULACIÓN DEL CLIENTE');


DROP TABLE IF EXISTS catalogo_soluciones;
CREATE TABLE catalogo_soluciones (
    id_solucion INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO catalogo_soluciones (nombre) VALUES 
('REVISIÓN DE DAÑO EN FIBRA + CAMBIO DE CONECTORES'), ('RADIO ENLACE'), ('CAMBIO DE CABLE RG6 / UTP'), 
('INSPECCIÓN'), ('INSTALACION DE ADICIONAL'), ('DOMÓTICA'), ('CAMBIO DE FO'), ('GENERAR CAMBIO DE FO'), 
('GENERAR TICKET AL NOC (PROBLEMA FIBRA ÓPTICA)'), ('GENERAR TICKET AL NOC (PROBLEMA HFC)'), 
('SOLUCIÓN PARCIAL'), ('SIN RESPUESTA DEL CLIENTE'), ('VISITA REAGENDADA'), ('VT COBRADA/CONECTOR ROTO'), 
('GESTIONAR ARREGLO DE INSTALACIÓN'), ('GENERAR CAMBIO DE CABLE UTP / RG6'), ('NO DESEA VISITA'), 
('INSTALACIÓN EFECTIVA'), ('REUBICACION DE EQUIPOS'), ('CAMBIO DE CONECTORES RG6'), 
('CAMBIO DE CONECTORES RJ45'), ('CAMBIO DE CONECTORES APC/UPC'), ('CAMBIO DE EQUIPO ONT'), 
('CONF. DE EQUIPOS GPON/ROUTER'), ('INSTALACIÓN DE ROUTER'), ('REVISIÓN DE DAÑO EN FIBRA + CAMBIO DE FIBRA'), 
('CAMBIO DE ROUTER ANTIGUO/PROBLEMAS'), ('CONEXIÓN ELÉCTRICA'), ('VT COBRADA/REUBICACIÓN DE EQUIPOS'), 
('COLOCACIÓN DE UNIÓN'), ('ARREGLO DE INSTALACIÓN'), ('RETIRO DE EQUIPOS/CORTE DE SERVICIO'), 
('NO SE PUEDE REALIZAR VISITA - SATURACIÓN DEL DÍA'), ('REVISIÓN COMPLETA POR RETENCIÓN');


-- UNIFICADA: Sectores con sus coordenadas por defecto en una sola lectura
DROP TABLE IF EXISTS catalogo_sectores;
CREATE TABLE catalogo_sectores (
    id_sector INT AUTO_INCREMENT PRIMARY KEY,
    nombre_sector VARCHAR(100) NOT NULL UNIQUE,
    latitud_defecto DOUBLE DEFAULT NULL,
    longitud_defecto DOUBLE DEFAULT NULL,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO catalogo_sectores (nombre_sector, latitud_defecto, longitud_defecto) VALUES
('EL VALLE', -2.9194, -78.9667), ('SANTA ANA', -2.9333, -78.9333), ('CAÑARIBAMBA', -2.9058, -79.0022), 
('CENTRO HISTORICO', -2.9001, -79.0059), ('BAÑOS', -2.9231, -79.0621), ('RICAURTE', -2.8667, -78.9667),
('ALTIPLANO', NULL, NULL), ('AV AMERICAS', NULL, NULL), ('AZOGUES', NULL, NULL), ('BARZALLO', NULL, NULL), 
('BELLO HORIZONTE', NULL, NULL), ('BEMANI', NULL, NULL), ('BOSQUE 1', NULL, NULL), ('BOSQUE 2', NULL, NULL), 
('BOSQUE DE MONAY', NULL, NULL), ('BUENAVENTURA', NULL, NULL), ('CASA PARA TODOS', NULL, NULL), 
('CATOLICA', NULL, NULL), ('CAPULISPAMBA', NULL, NULL), ('CARMEN DE GUZHO', NULL, NULL), 
('CARMEN DE SIDCAY', NULL, NULL), ('CARMEN DE SININCAY', NULL, NULL), ('CDLA. ALVAREZ', NULL, NULL), 
('CDLA. CALDERON', NULL, NULL), ('CDLA. DE LOS INGENIEROS', NULL, NULL), ('CDLA. DE LOS MEDICOS', NULL, NULL), 
('CDLA. KENNEDY', NULL, NULL), ('CDLA. PARAISO', NULL, NULL), ('CDLA. TOMEBAMBA', NULL, NULL), 
('CEBOLLAR', NULL, NULL), ('CHALLUABAMBA', NULL, NULL), ('CHECA', NULL, NULL), ('CHIQUINTAD', NULL, NULL), 
('CHUQUIPATA', NULL, NULL), ('COLISEO', NULL, NULL), ('COMPAÑIA', NULL, NULL), ('CONTROL SUR', NULL, NULL), 
('EL PINAR', NULL, NULL), ('EL ROSAL', NULL, NULL), ('EL SALADO', NULL, NULL), ('EL VERGEL', NULL, NULL), 
('EMPRESA ELECTRICA', NULL, NULL), ('ESTADIO', NULL, NULL), ('EUCALIPTOS', NULL, NULL), ('FLOR DE PLATA', NULL, NULL), 
('GAPAL', NULL, NULL), ('HOSPITAL DEL RIO', NULL, NULL), ('JAIME ROLDOS', NULL, NULL), ('JAVIER LOYOLA', NULL, NULL), 
('LA VICTORIA', NULL, NULL), ('LAGUNAS DEL SOL', NULL, NULL), ('LLACAO', NULL, NULL), ('MACHANGARA', NULL, NULL), 
('MALL DEL RIO', NULL, NULL), ('MIRAFLORES', NULL, NULL), ('MISICATA', NULL, NULL), ('MOLINOPAMBA', NULL, NULL), 
('MONAY', NULL, NULL), ('MONAY SHOPING', NULL, NULL), ('MUTUALISTA AZUAY', NULL, NULL), ('NARANCAY ALTO', NULL, NULL), 
('NARANCAY BAJO', NULL, NULL), ('ORDOÑES LAZO', NULL, NULL), ('ORQUIDEAS', NULL, NULL), ('PACCHA', NULL, NULL), 
('PATAMARCA', NULL, NULL), ('PENCAS', NULL, NULL), ('PUERTAS AL SOL', NULL, NULL), ('QUINTA CHICA', NULL, NULL), 
('RACAR', NULL, NULL), ('RAYOLOMA', NULL, NULL), ('RIELES DE MONAY', NULL, NULL), ('SININCAY', NULL, NULL), 
('TARQUI', NULL, NULL), ('TERMINAL', NULL, NULL), ('TOTORACOCHA', NULL, NULL), ('TRIGALES', NULL, NULL), 
('TRIGALES ALTOS', NULL, NULL), ('TRIGALES BAJOS', NULL, NULL), ('UNCOVIA', NULL, NULL), 
('URB. DE LOS PROFESORES', NULL, NULL), ('VELODROMO', NULL, NULL), ('VIA AL CAMAL', NULL, NULL), 
('VIA MAYANCELA', NULL, NULL), ('VIA MONAY-BAGUANCHI', NULL, NULL), ('VIA OCHOA LEON', NULL, NULL), 
('VILLA DORADA', NULL, NULL), ('VISOREY', NULL, NULL), ('YANUNCAY', NULL, NULL);


DROP TABLE IF EXISTS materiales;
CREATE TABLE materiales (
    id_material INT AUTO_INCREMENT PRIMARY KEY,
    nombre_material VARCHAR(100) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO materiales (nombre_material, unidad_medida) VALUES -- Corregido typo
('AMARRAS', 'UNIDADES'), ('FIBRA DROP 2 HILOS POR METRO', 'METROS'), 
('FIBRA DROP 1 HILO POR METRO', 'METROS'), ('CABLE RG6 POR METRO', 'METROS'), 
('CABLE UTP POR METRO', 'METROS'), ('CONECTOR UPC / APC', 'UNIDADES'), 
('CONECTOR RG6', 'UNIDADES'), ('CONECTOR RJ45', 'UNIDADES'), 
('GRAPAS', 'UNIDADES'), ('SPLITTER 1/2', 'UNIDADES');

-- ====================================================================
-- 2. TABLA MAESTRA DE VISITAS TÉCNICAS (ESTRUCTURA COMPLETA COMPACTADA)
-- ====================================================================

DROP TABLE IF EXISTS visitas_tecnicas;
CREATE TABLE visitas_tecnicas (
    id_visita INT AUTO_INCREMENT PRIMARY KEY,
    creado_por VARCHAR(100) NOT NULL,
    tecnico_principal VARCHAR(100) DEFAULT NULL,
    tecnico_apoyo VARCHAR(100) DEFAULT NULL,
    prioridad ENUM('ALTA', 'MEDIA', 'BAJA') DEFAULT 'MEDIA',
    
    -- Tiempos y Agendamiento Logístico
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_programada DATE NOT NULL,
    hora_en_ruta DATETIME DEFAULT NULL,
    hora_inicio_visita DATETIME DEFAULT NULL,
    hora_fin_visita DATETIME DEFAULT NULL,
    preferencia_horaria VARCHAR(150),
    ventana_inicio_min INT,
    ventana_fin_min INT,
    
    -- Datos del Cliente
    empresa VARCHAR(50),
    contrato VARCHAR(20),
    cliente VARCHAR(150) NOT NULL,
    telefonos VARCHAR(100),
    sector VARCHAR(100),
    direccion VARCHAR(255),
    
    -- Detalles Técnicos de Entrada
    servicio VARCHAR(50),
    velocidad_mbps INT,
    problema VARCHAR(150),
    observacion_callcenter TEXT,
    informacion_tecnico TEXT,
    
    -- RASTREO GPS EN VIVO (Optimizado a DOUBLE)
    token_rastreo VARCHAR(64) UNIQUE DEFAULT NULL,
    latitud_gps_vivo DOUBLE DEFAULT NULL,
    longitud_gps_vivo DOUBLE DEFAULT NULL,
    ultima_actualizacion_gps DATETIME DEFAULT NULL,
    
    -- Cierre del Técnico en Campo
    estado ENUM('PENDIENTE', 'REAGENDADA', 'EN_RUTA', 'EN_PROGRESO', 'FINALIZADA', 'CANCELADA', 'SOLVENTADA_REMOTA') DEFAULT 'PENDIENTE',
    solucion_tecnico VARCHAR(150) DEFAULT NULL,
    observacion_tecnico TEXT DEFAULT NULL,
    modelo_onu VARCHAR(50) DEFAULT NULL,
    modelo_router VARCHAR(50) DEFAULT NULL,
    coordenadas_tecnico VARCHAR(100) DEFAULT NULL,
    resolucion_final TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- 3. TABLAS DE RELACIÓN Y ACCESOS DE USUARIOS
-- ====================================================================

DROP TABLE IF EXISTS turnos_tecnicos;
CREATE TABLE turnos_tecnicos (
    id_turno INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    nombre_recurso VARCHAR(100) NOT NULL,
    es_pareja BOOLEAN DEFAULT FALSE,
    ventana_inicio_min INT NOT NULL,
    ventana_fin_min INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS directorio_clientes;
CREATE TABLE directorio_clientes (
    contrato VARCHAR(20) PRIMARY KEY,
    fecha_instalacion VARCHAR(50), 
    nombre_cliente VARCHAR(150) NOT NULL,
    zona VARCHAR(100),
    telefono1 VARCHAR(50),
    telefono2 VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS usuarios_callcenter;
CREATE TABLE usuarios_callcenter (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) DEFAULT 'ASESOR',
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO usuarios_callcenter (nombre, email, password_hash) VALUES 
('CC. Guissella Quezada', 'gquezada@futurity.com.ec', 'scrypt:32768:8:1$Z7DJcQPBxRRXyi9a$206377278635630412ca0b033fc81254e7f4a595077201bd171673ba1fdf5249163e624f4b92cf0ccc3eb715e35837a581d55329294776654c19ec52656e7892'),
('CC. Mateo Samaniego', 'msamaniego@futurity.com.ec', 'scrypt:32768:8:1$9TLZjB1jG1uQ9rjW$05fc2466c1a4b9c4558f5d313f7960f70c36aaade689ea82743c77139d467e97f94f22f64965cc567fdc2d40a8af09b6d63379c79393d76ccc2c87a70b347124'),
('CC. Luis Saenz', 'lsaenz@futurity.com.ec', 'scrypt:32768:8:1$MhyNFCK4x831SnHC$3498511043b81109f8177714488b9bbd90a4b2e0acd0f8241352d935d8d0adc41aac17b737fda0c31e747d59d7b36db004306f1687861df48a0a293abd9034ea');


DROP TABLE IF EXISTS visitas_materiales;
CREATE TABLE visitas_materiales (
    id_visita_material INT AUTO_INCREMENT PRIMARY KEY,
    id_visita INT NOT NULL,
    id_material INT NOT NULL,
    cantidad_usada INT NOT NULL,
    CONSTRAINT fk_material_visita FOREIGN KEY (id_visita) REFERENCES visitas_tecnicas(id_visita) ON DELETE CASCADE,
    CONSTRAINT fk_material_catalogo FOREIGN KEY (id_material) REFERENCES materiales(id_material) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tecnicos 
ADD COLUMN foto_perfil VARCHAR(255) DEFAULT 'default_avatar.png',
ADD COLUMN foto_vehiculo VARCHAR(255) DEFAULT 'furgoneta_milton.jpeg',
ADD COLUMN placa_vehiculo VARCHAR(255) DEFAULT 'S/P';

UPDATE tecnicos 
SET foto_perfil = 'erick_lojano.jpeg', 
    foto_vehiculo = 'furgoneta_milton.jpeg', 
    placa_vehiculo = 'ABE-9377' 
WHERE nombre = 'ERICK LOJANO';

ALTER TABLE visitas_tecnicas 
ADD COLUMN turno VARCHAR(50) DEFAULT NULL AFTER preferencia_horaria;

-- 1. Crear el catálogo de ONT / ONU
CREATE TABLE IF NOT EXISTS catalogo_modelos_ont (
    id_ont INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inyectamos la lista de ONTs
INSERT INTO catalogo_modelos_ont (nombre) VALUES 
('KINGTYPE'), ('HUAWEI'), ('TP-LINK'), ('CDATA'), 
('RADIO'), ('HFC'), ('SWITCH'), ('SMART HOME'), ('SIN INFO');

-- 2. Crear el catálogo de Routers (Queda vacía por ahora a la espera de tu lista)
CREATE TABLE IF NOT EXISTS catalogo_modelos_router (
    id_router INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inyectamos lista de routers
INSERT INTO catalogo_modelos_router (nombre) VALUES 
('HUAWEI AX3'), 
('HUAWEI AX2 V1'), 
('TPLINK WIFI 6'), 
('MERCUSYS WIFI 6'), 
('CDATA WIFI 6'), 
('MIKROTIK'), 
('OTROS'), 
('HFC'), 
('CABLE'), 
('SIN INFO'), 
('SMART HOME');