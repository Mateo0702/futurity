class RequisicionItem {
  final int idItem;
  final int idMaterial;
  final String nombreMaterial;
  final int cantidadSolicitada;
  final int cantidadAprobada;

  RequisicionItem({
    required this.idItem,
    required this.idMaterial,
    required this.nombreMaterial,
    required this.cantidadSolicitada,
    required this.cantidadAprobada,
  });

  factory RequisicionItem.fromJson(Map<String, dynamic> json) {
    return RequisicionItem(
      idItem: json['id_item'] is int ? json['id_item'] : int.tryParse(json['id_item'].toString()) ?? 0,
      idMaterial: json['id_material'] is int ? json['id_material'] : int.tryParse(json['id_material'].toString()) ?? 0,
      nombreMaterial: json['nombre_material'] ?? 'Material',
      cantidadSolicitada: json['cantidad_solicitada'] is int
          ? json['cantidad_solicitada']
          : int.tryParse(json['cantidad_solicitada'].toString()) ?? 0,
      cantidadAprobada: json['cantidad_aprobada'] is int
          ? json['cantidad_aprobada']
          : int.tryParse(json['cantidad_aprobada'].toString()) ?? 0,
    );
  }
}

class Requisicion {
  final int idRequisicion;
  final String numeroRequisicion;
  final String fechaSolicitud;
  final String estado;
  final String observaciones;
  final List<RequisicionItem> items;
  final bool requiereFirma;

  Requisicion({
    required this.idRequisicion,
    required this.numeroRequisicion,
    required this.fechaSolicitud,
    required this.estado,
    required this.observaciones,
    required this.items,
    required this.requiereFirma,
  });

  factory Requisicion.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'] as List? ?? [];
    final itemsList = rawItems.map((i) => RequisicionItem.fromJson(i)).toList();

    final estadoStr = json['estado']?.toString() ?? 'SOLICITADO';
    final firmaRegistrada = json['firma_tecnico'] != null && json['firma_tecnico'].toString().isNotEmpty;

    return Requisicion(
      idRequisicion: json['id_requisicion'] is int
          ? json['id_requisicion']
          : int.tryParse(json['id_requisicion'].toString()) ?? 0,
      numeroRequisicion: json['numero_requisicion'] ?? 'REQ-${json['id_requisicion']}',
      fechaSolicitud: json['fecha_solicitud']?.toString() ?? '',
      estado: estadoStr,
      observaciones: json['observaciones'] ?? '',
      items: itemsList,
      requiereFirma: (estadoStr == 'APROBADO_BODEGA' || estadoStr == 'ENTREGADO') && !firmaRegistrada,
    );
  }
}
