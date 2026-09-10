import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/requisicion_model.dart';
import '../services/api_service.dart';
import '../widgets/firma_canvas_widget.dart';

class MisRequisicionesScreen extends StatefulWidget {
  final List<dynamic> catalogoMateriales;
  final String placaVehiculo;
  final String tecnicoNombre;

  const MisRequisicionesScreen({
    super.key,
    this.catalogoMateriales = const [],
    this.placaVehiculo = 'S/P',
    this.tecnicoNombre = 'Técnico',
  });

  @override
  State<MisRequisicionesScreen> createState() => _MisRequisicionesScreenState();
}

class _MisRequisicionesScreenState extends State<MisRequisicionesScreen> {
  bool _isLoading = true;
  List<Requisicion> _requisiciones = [];
  int _totalListasParaFirmar = 0;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadRequisiciones();
  }

  Future<void> _loadRequisiciones() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await ApiService.getMisRequisiciones();
    if (!mounted) return;

    if (res['success'] == true) {
      setState(() {
        _requisiciones = (res['requisiciones'] as List<Requisicion>?) ?? [];
        _totalListasParaFirmar = res['total_listas_para_firmar'] ?? 0;
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = res['message'] ?? 'Error al obtener requisiciones';
        _isLoading = false;
      });
    }
  }

  void _showFirmaModal(Requisicion req) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Firma Recepción Materiales', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                  IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white70), onPressed: () => Navigator.pop(context)),
                ],
              ),
              Text(
                'Firma para confirmar la recepción física de insumos de la solicitud ${req.numeroRequisicion}.',
                style: GoogleFonts.inter(fontSize: 12.5, color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 16),
              FirmaCanvasWidget(
                height: 180,
                onConfirm: (firmaBase64) async {
                  Navigator.pop(context);
                  setState(() => _isSubmitting = true);
                  final res = await ApiService.firmarRequisicion(req.idRequisicion, firmaBase64);
                  if (!mounted) return;
                  setState(() => _isSubmitting = false);

                  if (res['success'] == true) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(res['message'] ?? 'Firma registrada con éxito'), backgroundColor: const Color(0xFF10B981)),
                    );
                    _loadRequisiciones();
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(res['message'] ?? 'Error al registrar la firma'), backgroundColor: const Color(0xFFF87171)),
                    );
                  }
                },
              ),

            ],
          ),
        );
      },
    );
  }

  void _showNuevaSolicitudModal() {
    final List<Map<String, dynamic>> itemsForm = [
      {'id_material': null, 'cantidad_solicitada': 1}
    ];
    String obs = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Nueva Solicitud a Bodega', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                        IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white70), onPressed: () => Navigator.pop(context)),
                      ],
                    ),
                    Text('Solicitud de materiales para el vehículo ${widget.placaVehiculo}', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF38BDF8))),
                    const SizedBox(height: 16),

                    // Dynamic list of items
                    ...itemsForm.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final item = entry.value;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<int>(
                                  dropdownColor: const Color(0xFF0F172A),
                                  value: item['id_material'],
                                  hint: Text('Material...', style: GoogleFonts.inter(color: Colors.white38, fontSize: 13)),
                                  isExpanded: true,
                                  items: widget.catalogoMateriales.map<DropdownMenuItem<int>>((m) {
                                    final idMat = m['id_material'] is int ? m['id_material'] : int.tryParse(m['id_material'].toString()) ?? 0;
                                    return DropdownMenuItem<int>(
                                      value: idMat,
                                      child: Text(m['nombre_material'] ?? 'Material', style: GoogleFonts.inter(color: Colors.white, fontSize: 13)),
                                    );
                                  }).toList(),
                                  onChanged: (val) {
                                    setModalState(() {
                                      item['id_material'] = val;
                                    });
                                  },
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 65,
                              child: TextFormField(
                                initialValue: item['cantidad_solicitada'].toString(),
                                keyboardType: TextInputType.number,
                                style: GoogleFonts.inter(color: Colors.white),
                                decoration: InputDecoration(
                                  filled: true,
                                  fillColor: const Color(0xFF1E293B),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                                ),
                                onChanged: (val) {
                                  item['cantidad_solicitada'] = int.tryParse(val) ?? 1;
                                },
                              ),
                            ),
                            if (itemsForm.length > 1)
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFFF87171), size: 20),
                                onPressed: () {
                                  setModalState(() {
                                    itemsForm.removeAt(idx);
                                  });
                                },
                              ),
                          ],
                        ),
                      );
                    }),

                    TextButton.icon(
                      onPressed: () {
                        setModalState(() {
                          itemsForm.add({'id_material': null, 'cantidad_solicitada': 1});
                        });
                      },
                      icon: const Icon(Icons.add_rounded, color: Color(0xFF38BDF8)),
                      label: Text('Agregar otro material', style: GoogleFonts.inter(color: const Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 12),

                    Text('Observaciones:', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
                    const SizedBox(height: 6),
                    TextFormField(
                      maxLines: 2,
                      style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Justificación o detalle para Bodega...',
                        hintStyle: GoogleFonts.inter(color: Colors.white38),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white10)),
                      ),
                      onChanged: (val) => obs = val,
                    ),
                    const SizedBox(height: 20),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF38BDF8),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.send_rounded, color: Colors.black),
                        label: Text('Enviar a Bodega', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
                        onPressed: () async {
                          final validItems = itemsForm.where((it) => it['id_material'] != null && (it['cantidad_solicitada'] as int) > 0).toList();
                          if (validItems.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Selecciona al menos un material válido')));
                            return;
                          }

                          Navigator.pop(context);
                          setState(() => _isSubmitting = true);
                          final res = await ApiService.crearSolicitudBodega(
                            placaVehiculo: widget.placaVehiculo,
                            nombreTecnico: widget.tecnicoNombre,
                            items: validItems,
                            observaciones: obs,
                          );
                          if (!mounted) return;
                          setState(() => _isSubmitting = false);

                          if (res['success'] == true) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Solicitud creada con éxito'), backgroundColor: const Color(0xFF10B981)));
                            _loadRequisiciones();
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message'] ?? 'Error al enviar solicitud'), backgroundColor: const Color(0xFFF87171)));
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Color _getEstadoColor(String estado) {
    switch (estado.toUpperCase()) {
      case 'APROBADO_BODEGA':
      case 'ENTREGADO':
        return const Color(0xFF10B981);
      case 'CANCELADO':
      case 'RECHAZADO':
        return const Color(0xFFF87171);
      default:
        return const Color(0xFFFBBF24);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Row(
          children: [
            const Icon(Icons.inventory_rounded, color: Color(0xFF38BDF8), size: 22),
            const SizedBox(width: 10),
            Text('Requisiciones a Bodega', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: _loadRequisiciones,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNuevaSolicitudModal,
        backgroundColor: const Color(0xFF38BDF8),
        icon: const Icon(Icons.add_rounded, color: Colors.black),
        label: Text('Solicitar Material', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black)),
      ),
      body: _isLoading || _isSubmitting
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF38BDF8)))
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Color(0xFFF87171), size: 48),
                      const SizedBox(height: 12),
                      Text(_errorMessage!, style: GoogleFonts.inter(color: Colors.white70)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadRequisiciones,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF38BDF8)),
                        child: const Text('Reintentar', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                )
              : _requisiciones.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.post_add_rounded, size: 54, color: Color(0xFF64748B)),
                          const SizedBox(height: 12),
                          Text('Sin requisiciones activas', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                          Text('Presiona el botón para solicitar insumos a Bodega Central.', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _requisiciones.length,
                      itemBuilder: (context, index) {
                        final req = _requisiciones[index];
                        final statusColor = _getEstadoColor(req.estado);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: req.requiereFirma ? const Color(0xFFFBBF24).withValues(alpha: 0.6) : Colors.white.withValues(alpha: 0.06),
                              width: req.requiereFirma ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(req.numeroRequisicion, style: GoogleFonts.robotoMono(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
                                    child: Text(
                                      req.estado,
                                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w900, color: statusColor),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),

                              // Items preview
                              ...req.items.map((it) => Padding(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.arrow_right_rounded, color: Color(0xFF38BDF8), size: 16),
                                        Expanded(
                                          child: Text('${it.nombreMaterial} x ${it.cantidadSolicitada}', style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFFCBD5E1))),
                                        ),
                                      ],
                                    ),
                                  )),
                              const SizedBox(height: 10),

                              if (req.requiereFirma)
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFFBBF24),
                                      padding: const EdgeInsets.symmetric(vertical: 10),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    icon: const Icon(Icons.draw_rounded, color: Colors.black),
                                    label: Text('Firmar Recepción de Materiales', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Colors.black, fontSize: 13.5)),
                                    onPressed: () => _showFirmaModal(req),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}
