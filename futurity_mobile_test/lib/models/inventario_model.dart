class MaterialVehiculo {
  final int idMaterial;
  final String nombreMaterial;
  final String unidadMedida;
  final int cantidadActual;

  MaterialVehiculo({
    required this.idMaterial,
    required this.nombreMaterial,
    required this.unidadMedida,
    required this.cantidadActual,
  });

  factory MaterialVehiculo.fromJson(Map<String, dynamic> json) {
    return MaterialVehiculo(
      idMaterial: json['id_material'] is int
          ? json['id_material']
          : int.tryParse(json['id_material'].toString()) ?? 0,
      nombreMaterial: json['nombre_material'] ?? 'Material Sin Nombre',
      unidadMedida: json['unidad_medida'] ?? 'UNID',
      cantidadActual: json['cantidad_actual'] is int
          ? json['cantidad_actual']
          : int.tryParse(json['cantidad_actual'].toString()) ?? 0,
    );
  }
}

class EquipoRetirado {
  final int idRetiro;
  final int idVisita;
  final String tipoEquipo;
  final String serialNumber;
  final String estadoEquipo;
  final String clienteNombre;
  final String fechaRetiro;

  EquipoRetirado({
    required this.idRetiro,
    required this.idVisita,
    required this.tipoEquipo,
    required this.serialNumber,
    required this.estadoEquipo,
    required this.clienteNombre,
    required this.fechaRetiro,
  });

  factory EquipoRetirado.fromJson(Map<String, dynamic> json) {
    return EquipoRetirado(
      idRetiro: json['id_retiro'] is int
          ? json['id_retiro']
          : int.tryParse(json['id_retiro'].toString()) ?? 0,
      idVisita: json['id_visita'] is int
          ? json['id_visita']
          : int.tryParse(json['id_visita'].toString()) ?? 0,
      tipoEquipo: json['tipo_equipo'] ?? 'EQUIPO',
      serialNumber: json['serial_number'] ?? 'S/N',
      estadoEquipo: json['estado_equipo'] ?? 'EN_CUSTODIA',
      clienteNombre: json['cliente_nombre'] ?? 'Cliente S/N',
      fechaRetiro: json['fecha_retiro']?.toString() ?? '',
    );
  }
}
