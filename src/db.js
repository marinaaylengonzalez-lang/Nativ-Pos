// ── Capa de datos — Nativ POS ──────────────────────────────────
// Todas las funciones que hablan con Supabase viven aquí.
// La UI nunca llama a `sb.from(...)` directamente: siempre pasa por
// estas funciones, así si cambiamos algo de la base, solo tocamos
// este archivo.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── SESIÓN / NEGOCIO ────────────────────────────────────────────
export async function getSessionUser(){
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

export async function getMiNegocio(){
  const user = await getSessionUser();
  if(!user) return null;
  const { data, error } = await sb.from('negocios').select('*').eq('owner_id', user.id).limit(1);
  if(error || !data || data.length === 0) return null;
  return data[0];
}

export async function actualizarConfigNegocio(negocioId, patchConfig){
  // patchConfig se mergea dentro de la columna jsonb `config`
  const { data: actual } = await sb.from('negocios').select('config').eq('id', negocioId).single();
  const nuevoConfig = { ...(actual?.config || {}), ...patchConfig };
  const { data, error } = await sb.from('negocios').update({ config: nuevoConfig }).eq('id', negocioId).select().single();
  return { data, error };
}

export async function actualizarNegocio(negocioId, campos){
  const { data, error } = await sb.from('negocios').update(campos).eq('id', negocioId).select().single();
  return { data, error };
}

// ── EMPLEADOS ───────────────────────────────────────────────────
export async function listarEmpleados(negocioId){
  const { data, error } = await sb.from('empleados').select('id,nombre,rol,activo').eq('negocio_id', negocioId).eq('activo', true).order('nombre');
  return data || [];
}

export async function crearEmpleado(negocioId, nombre, pin, rol){
  const { data, error } = await sb.rpc('crear_empleado', {
    p_negocio_id: negocioId, p_nombre: nombre, p_pin: pin, p_rol: rol
  });
  return { data, error };
}

export async function validarPinEmpleado(negocioId, empleadoId, pin){
  const { data, error } = await sb.rpc('validar_pin_empleado', {
    p_negocio_id: negocioId, p_empleado_id: empleadoId, p_pin: pin
  });
  if(error || !data || data.length === 0) return null;
  return data[0]; // { id, nombre, rol }
}

export async function eliminarEmpleado(empleadoId){
  const { error } = await sb.from('empleados').update({ activo: false }).eq('id', empleadoId);
  return { error };
}

// ── CATEGORÍAS ──────────────────────────────────────────────────
export async function listarCategorias(negocioId){
  const { data } = await sb.from('categorias').select('*').eq('negocio_id', negocioId).order('orden');
  return data || [];
}

export async function crearCategoria(negocioId, nombre, color){
  const { data, error } = await sb.from('categorias').insert({ negocio_id: negocioId, nombre, color }).select().single();
  return { data, error };
}

export async function eliminarCategoria(categoriaId){
  const { error } = await sb.from('categorias').delete().eq('id', categoriaId);
  return { error };
}

// ── PRODUCTOS ───────────────────────────────────────────────────
export async function listarProductos(negocioId){
  const { data } = await sb.from('productos').select('*').eq('negocio_id', negocioId).eq('activo', true).order('nombre');
  return data || [];
}

export async function crearProducto(negocioId, producto){
  const { data, error } = await sb.from('productos').insert({ negocio_id: negocioId, ...producto }).select().single();
  return { data, error };
}

export async function actualizarProducto(productoId, campos){
  const { data, error } = await sb.from('productos').update(campos).eq('id', productoId).select().single();
  return { data, error };
}

// ── FOTOS DE PRODUCTOS (Supabase Storage) ──────────────────────
export async function subirFotoProducto(negocioId, productoId, file){
  const ext = file.name.split('.').pop();
  const path = `${negocioId}/${productoId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await sb.storage.from('productos').upload(path, file, { upsert: true });
  if(uploadError) return { url: null, error: uploadError };

  const { data } = sb.storage.from('productos').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function eliminarProducto(productoId){
  const { error } = await sb.from('productos').update({ activo: false }).eq('id', productoId);
  return { error };
}

export async function ajustarStock(productoId, delta){
  const { data: actual } = await sb.from('productos').select('stock').eq('id', productoId).single();
  const nuevoStock = Math.max(0, (actual?.stock || 0) + delta);
  const { data, error } = await sb.from('productos').update({ stock: nuevoStock }).eq('id', productoId).select().single();
  return { data, error };
}

// ── CLIENTES ────────────────────────────────────────────────────
export async function listarClientes(negocioId){
  const { data } = await sb.from('clientes').select('*').eq('negocio_id', negocioId).order('nombre');
  return data || [];
}

export async function crearCliente(negocioId, cliente){
  const { data, error } = await sb.from('clientes').insert({ negocio_id: negocioId, ...cliente }).select().single();
  return { data, error };
}

export async function actualizarCliente(clienteId, campos){
  const { data, error } = await sb.from('clientes').update(campos).eq('id', clienteId).select().single();
  return { data, error };
}

export async function saldoCliente(clienteId){
  const { data, error } = await sb.rpc('saldo_cliente', { p_cliente_id: clienteId });
  return data || 0;
}

export async function movimientosCliente(clienteId){
  const { data } = await sb.from('movimientos_cliente').select('*').eq('cliente_id', clienteId).order('ts', { ascending: false });
  return data || [];
}

export async function registrarMovimientoCliente(clienteId, negocioId, tipo, monto, descripcion){
  const { data, error } = await sb.from('movimientos_cliente').insert({
    cliente_id: clienteId, negocio_id: negocioId, tipo, monto, descripcion
  }).select().single();
  return { data, error };
}

// ── TURNOS ──────────────────────────────────────────────────────
export async function turnoAbierto(negocioId){
  // Usamos limit(1) y tomamos [0] para evitar el error 406 de .single()
  // cuando no hay filas — compatible con todas las versiones de supabase-js.
  const { data } = await sb.from('turnos').select('*').eq('negocio_id', negocioId).is('cerrado_en', null).order('abierto_en', { ascending: false }).limit(1);
  return (data && data.length > 0) ? data[0] : null;
}

export async function abrirTurno(negocioId, empleadoId, montoInicial){
  const { data, error } = await sb.from('turnos').insert({
    negocio_id: negocioId, empleado_id: empleadoId, monto_inicial: montoInicial
  }).select().single();
  return { data, error };
}

export async function cerrarTurno(turnoId, montoFinalDeclarado, diferencia){
  const { data, error } = await sb.from('turnos').update({
    monto_final_declarado: montoFinalDeclarado,
    diferencia: diferencia,
    cerrado_en: new Date().toISOString()
  }).eq('id', turnoId).select().single();
  return { data, error };
}

// ── MESAS ───────────────────────────────────────────────────────
export async function listarMesas(negocioId){
  const { data } = await sb.from('mesas').select('*').eq('negocio_id', negocioId).order('nombre');
  return data || [];
}

export async function crearMesa(negocioId, nombre, zona, capacidad){
  const { data, error } = await sb.from('mesas').insert({ negocio_id: negocioId, nombre, zona, capacidad }).select().single();
  return { data, error };
}

export async function actualizarMesa(mesaId, campos){
  const { data, error } = await sb.from('mesas').update(campos).eq('id', mesaId).select().single();
  return { data, error };
}

export async function listarPedidosMesa(mesaId){
  const { data } = await sb.from('pedidos_mesa').select('*').eq('mesa_id', mesaId).order('creado_en');
  return data || [];
}

export async function agregarPedidoMesa(mesaId, negocioId, empleadoId, producto){
  return agregarPedidoMesaConCantidad(mesaId, negocioId, empleadoId, producto, 1);
}

export async function agregarPedidoMesaConCantidad(mesaId, negocioId, empleadoId, producto, cantidad){
  const { data, error } = await sb.from('pedidos_mesa').insert({
    mesa_id: mesaId, negocio_id: negocioId, empleado_id: empleadoId,
    producto_id: producto.id, nombre_producto: producto.nombre,
    precio_unitario: producto.precio, cantidad: cantidad
  }).select().single();
  return { data, error };
}

export async function actualizarCantidadPedido(pedidoId, cantidad){
  if(cantidad <= 0){
    const { error } = await sb.from('pedidos_mesa').delete().eq('id', pedidoId);
    return { error };
  }
  const { data, error } = await sb.from('pedidos_mesa').update({ cantidad }).eq('id', pedidoId).select().single();
  return { data, error };
}

export async function vaciarPedidosMesa(mesaId){
  const { error } = await sb.from('pedidos_mesa').delete().eq('mesa_id', mesaId);
  return { error };
}

// ── VENTAS ──────────────────────────────────────────────────────
export async function registrarVenta(params){
  const { data, error } = await sb.rpc('registrar_venta', {
    p_negocio_id: params.negocioId,
    p_empleado_id: params.empleadoId,
    p_turno_id: params.turnoId,
    p_mesa_id: params.mesaId || null,
    p_cliente_id: params.clienteId || null,
    p_subtotal: params.subtotal,
    p_descuento: params.descuento || 0,
    p_total: params.total,
    p_metodo_pago: params.metodoPago,
    p_efectivo_recibido: params.efectivoRecibido || null,
    p_tc_usado: params.tcUsado || null,
    p_nota: params.nota || null,
    p_items: params.items // [{producto_id, nombre_producto, precio_unitario, cantidad}]
  });
  return { data, error };
}

export async function anularVenta(ventaId){
  const { error } = await sb.rpc('anular_venta', { p_venta_id: ventaId });
  return { error };
}

export async function listarVentas(negocioId, { desde, hasta, turnoId } = {}){
  let q = sb.from('ventas').select('*, venta_items(*)').eq('negocio_id', negocioId).eq('anulada', false).order('ts', { ascending: false });
  if(turnoId) q = q.eq('turno_id', turnoId);
  if(desde) q = q.gte('ts', desde);
  if(hasta) q = q.lte('ts', hasta);
  const { data } = await q;
  return data || [];
}

// ── GASTOS (Finanzas) ───────────────────────────────────────────
export async function listarGastosFijos(negocioId){
  const { data } = await sb.from('gastos_fijos').select('*').eq('negocio_id', negocioId).order('nombre');
  return data || [];
}

export async function crearGastoFijo(negocioId, nombre, monto, categoria){
  const { data, error } = await sb.from('gastos_fijos').insert({ negocio_id: negocioId, nombre, monto, categoria }).select().single();
  return { data, error };
}

export async function actualizarGastoFijo(id, campos){
  const { data, error } = await sb.from('gastos_fijos').update(campos).eq('id', id).select().single();
  return { data, error };
}

export async function eliminarGastoFijo(id){
  const { error } = await sb.from('gastos_fijos').delete().eq('id', id);
  return { error };
}

export async function listarGastosVariables(negocioId, mesISO){
  let q = sb.from('gastos_variables').select('*').eq('negocio_id', negocioId).order('ts', { ascending: false });
  const { data } = await q;
  return (data || []).filter(g => !mesISO || g.ts.slice(0,7) === mesISO);
}

export async function crearGastoVariable(negocioId, nombre, monto, categoria){
  const { data, error } = await sb.from('gastos_variables').insert({ negocio_id: negocioId, nombre, monto, categoria }).select().single();
  return { data, error };
}

export async function eliminarGastoVariable(id){
  const { error } = await sb.from('gastos_variables').delete().eq('id', id);
  return { error };
}

// ── MODIFICADORES ───────────────────────────────────────────
export async function listarModificadoresProducto(productoId){
  const { data } = await sb.from('modificador_grupos')
    .select('*, modificador_opciones(*)')
    .eq('producto_id', productoId)
    .order('orden');
  return data || [];
}

export async function crearGrupoModificador(negocioId, productoId, nombre, requerido, multiple){
  const { data, error } = await sb.from('modificador_grupos')
    .insert({ negocio_id: negocioId, producto_id: productoId, nombre, requerido, multiple })
    .select().single();
  return { data, error };
}

export async function actualizarGrupoModificador(grupoId, campos){
  const { data, error } = await sb.from('modificador_grupos')
    .update(campos).eq('id', grupoId).select().single();
  return { data, error };
}

export async function eliminarGrupoModificador(grupoId){
  const { error } = await sb.from('modificador_grupos').delete().eq('id', grupoId);
  return { error };
}

export async function crearOpcionModificador(negocioId, grupoId, nombre){
  const { data, error } = await sb.from('modificador_opciones')
    .insert({ negocio_id: negocioId, grupo_id: grupoId, nombre })
    .select().single();
  return { data, error };
}

export async function eliminarOpcionModificador(opcionId){
  const { error } = await sb.from('modificador_opciones').delete().eq('id', opcionId);
  return { error };
}

export async function guardarModificadoresPedido(pedidoId, modificadores){
  const { error } = await sb.from('pedidos_mesa')
    .update({ modificadores })
    .eq('id', pedidoId);
  return { error };
}
