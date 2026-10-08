class MaterialVehiculo {
  final int idMaterial;
  final String nombreMaterial;
  final String codigoMaterial;
  final String unidadMedida;
  final String categoria;
  final int cantidadActual;

  MaterialVehiculo({
    required this.idMaterial,
    required this.nombreMaterial,
    this.codigoMaterial = '',
    required this.unidadMedida,
    this.categoria = '',
    required this.cantidadActual,
  });

  factory MaterialVehiculo.fromJson(Map<String, dynamic> json) {
    final rawQty = json['cantidad_disponible'] ??
        json['cantidad_actual'] ??
        json['cantidad'] ??
        0;
    int parsedQty = 0;
    if (rawQty is num) {
      parsedQty = rawQty.toInt();
    } else if (rawQty is String) {
      parsedQty = (double.tryParse(rawQty) ?? 0).toInt();
    }

    return MaterialVehiculo(
      idMaterial: json['id_material'] is int
          ? json['id_material']
          : int.tryParse(json['id_material']?.toString() ?? '0') ?? 0,
      nombreMaterial: json['nombre_material']?.toString() ?? 'Material Sin Nombre',
      codigoMaterial: json['codigo_material']?.toString() ?? '',
      unidadMedida: json['unidad_medida']?.toString() ?? 'UNID',
      categoria: json['categoria']?.toString() ?? '',
      cantidadActual: parsedQty,
    );
  }
}

class EquipoRetirado {
  final int idRetiro;
  final int idVisita;
  final String tipoEquipo;
  final String serialNumber;
  final String modelo;
  final String motivoRetiro;
  final String observacionRetiro;
  final String estadoEquipo;
  final String clienteNombre;
  final String contrato;
  final String fechaRetiro;

  EquipoRetirado({
    required this.idRetiro,
    required this.idVisita,
    required this.tipoEquipo,
    required this.serialNumber,
    this.modelo = '',
    this.motivoRetiro = '',
    this.observacionRetiro = '',
    required this.estadoEquipo,
    required this.clienteNombre,
    this.contrato = '',
    required this.fechaRetiro,
  });

  factory EquipoRetirado.fromJson(Map<String, dynamic> json) {
    return EquipoRetirado(
      idRetiro: json['id_retiro'] is int
          ? json['id_retiro']
          : int.tryParse(json['id_retiro']?.toString() ?? '0') ?? 0,
      idVisita: json['id_visita'] is int
          ? json['id_visita']
          : int.tryParse(json['id_visita']?.toString() ?? '0') ?? 0,
      tipoEquipo: json['tipo_equipo']?.toString() ?? 'EQUIPO',
      serialNumber: (json['numero_serie'] ?? json['serial_number'] ?? 'S/N').toString(),
      modelo: (json['modelo'] ?? '').toString(),
      motivoRetiro: (json['motivo_retiro'] ?? '').toString(),
      observacionRetiro: (json['observacion_retiro'] ?? '').toString(),
      estadoEquipo: (json['estado_custodia'] ?? json['estado_equipo'] ?? 'EN_VEHICULO').toString(),
      clienteNombre: (json['cliente'] ?? json['cliente_nombre'] ?? 'Sin Cliente').toString(),
      contrato: (json['contrato'] ?? '').toString(),
      fechaRetiro: (json['fecha_retiro'] ?? '').toString(),
    );
  }
}
