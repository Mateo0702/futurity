class VisitaModel {
  final int idVisita;
  final int numeroParada;
  final String cliente;
  final String contrato;
  final String sector;
  final String direccion;
  final String telefonos;
  final String servicio;
  final String problema;
  final String observacionCallcenter;
  final String preferenciaHoraria;
  final String prioridad;
  final String estado;
  final double? latitud;
  final double? longitud;
  final String? informacionTecnico;
  final int cantidadRouters;

  // Campos Enriquecidos (Red, Equipos y Comercial)
  final String? numeroSerie;
  final String? modeloOnt;
  final String? routerPrincipal;
  final String? numeroSerieRouter;
  final String? routerSecundario;
  final String? numeroSerieRouterSecundario;
  final String? tipoMesh;
  final String? modoAcceso;
  final String? infoCaja;
  final String? infoHilo;
  final String? infoIp;
  final String? infoVlan;
  final String? infoUsr;
  final String? infoPas;
  final String? nodoNombre;
  final String? velocidadMbps;
  final String? producto;
  final String? antiguedadFmt;
  final String? cedula;
  final double? totalMensual;

  VisitaModel({
    required this.idVisita,
    required this.numeroParada,
    required this.cliente,
    required this.contrato,
    required this.sector,
    required this.direccion,
    required this.telefonos,
    required this.servicio,
    required this.problema,
    required this.observacionCallcenter,
    required this.preferenciaHoraria,
    required this.prioridad,
    required this.estado,
    this.latitud,
    this.longitud,
    this.informacionTecnico,
    this.cantidadRouters = 1,
    this.numeroSerie,
    this.modeloOnt,
    this.routerPrincipal,
    this.numeroSerieRouter,
    this.routerSecundario,
    this.numeroSerieRouterSecundario,
    this.tipoMesh,
    this.modoAcceso,
    this.infoCaja,
    this.infoHilo,
    this.infoIp,
    this.infoVlan,
    this.infoUsr,
    this.infoPas,
    this.nodoNombre,
    this.velocidadMbps,
    this.producto,
    this.antiguedadFmt,
    this.cedula,
    this.totalMensual,
  });

  factory VisitaModel.fromJson(Map<String, dynamic> json) {
    double? parseDouble(dynamic val) {
      if (val == null) return null;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString());
    }

    return VisitaModel(
      idVisita: json['id_visita'] is int ? json['id_visita'] : int.tryParse(json['id_visita']?.toString() ?? '0') ?? 0,
      numeroParada: json['numero_parada'] is int ? json['numero_parada'] : int.tryParse(json['numero_parada']?.toString() ?? '0') ?? 0,
      cliente: json['cliente']?.toString() ?? 'Sin Cliente',
      contrato: json['contrato']?.toString() ?? 'S/C',
      sector: json['sector']?.toString() ?? 'Sin Sector',
      direccion: json['direccion']?.toString() ?? '',
      telefonos: json['telefonos']?.toString() ?? '',
      servicio: json['servicio']?.toString() ?? '',
      problema: json['problema']?.toString() ?? 'Soporte General',
      observacionCallcenter: json['observacion_callcenter']?.toString() ?? '',
      preferenciaHoraria: json['preferencia_horaria']?.toString() ?? 'Todo el día',
      prioridad: json['prioridad']?.toString() ?? 'MEDIA',
      estado: json['estado']?.toString() ?? 'PENDIENTE',
      latitud: parseDouble(json['latitud']),
      longitud: parseDouble(json['longitud']),
      informacionTecnico: json['informacion_tecnico']?.toString(),
      cantidadRouters: json['cantidad_routers'] is int ? json['cantidad_routers'] : int.tryParse(json['cantidad_routers']?.toString() ?? '1') ?? 1,
      numeroSerie: json['numero_serie']?.toString(),
      modeloOnt: json['modelo_ont']?.toString(),
      routerPrincipal: json['router_principal']?.toString(),
      numeroSerieRouter: json['numero_serie_router']?.toString(),
      routerSecundario: json['router_secundario']?.toString(),
      numeroSerieRouterSecundario: json['numero_serie_router_secundario']?.toString(),
      tipoMesh: json['tipo_mesh']?.toString(),
      modoAcceso: json['modo_acceso']?.toString(),
      infoCaja: json['info_caja']?.toString(),
      infoHilo: json['info_hilo']?.toString(),
      infoIp: json['info_ip']?.toString(),
      infoVlan: json['info_vlan']?.toString(),
      infoUsr: json['info_usr']?.toString(),
      infoPas: json['info_pas']?.toString(),
      nodoNombre: json['nodo_nombre']?.toString(),
      velocidadMbps: json['velocidad_mbps']?.toString(),
      producto: json['producto']?.toString(),
      antiguedadFmt: json['antiguedad_fmt']?.toString(),
      cedula: json['cedula']?.toString(),
      totalMensual: parseDouble(json['total_mensual']),
    );
  }
}
