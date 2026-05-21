import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

const ROLES = { admin: "Administrador", tech: "Técnico", user: "Empleado" };
const CATEGORIES = ["Hardware", "Software", "Red / Conectividad", "Accesos y Permisos", "Impresoras", "Otro"];
const PRIORITIES = ["Baja", "Media", "Alta", "Crítica"];
const STATUSES = ["Abierto", "En progreso", "Resuelto", "Cerrado"];

const priorityColor = { Baja: "#1D9E75", Media: "#BA7517", Alta: "#D85A30", Crítica: "#A32D2D" };
const statusColor = { Abierto: "#378ADD", "En progreso": "#BA7517", Resuelto: "#1D9E75", Cerrado: "#888780" };
const statusBg = { Abierto: "#E6F1FB", "En progreso": "#FAEEDA", Resuelto: "#E1F5EE", Cerrado: "#F1EFE8" };
const statusText = { Abierto: "#0C447C", "En progreso": "#633806", Resuelto: "#085041", Cerrado: "#444441" };

const Avatar = ({ initials, size = 32 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, fontSize: size * 0.35, color: "#185FA5", flexShrink: 0 }}>{initials}</div>
);

const Badge = ({ label, bg, color }) => (
  <span style={{ background: bg, color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>{label}</span>
);

const StatusBadge = ({ status }) => <Badge label={status} bg={statusBg[status]} color={statusText[status]} />;
const PriorityBadge = ({ priority }) => (
  <Badge label={priority}
    bg={priority === "Crítica" ? "#FCEBEB" : priority === "Alta" ? "#FAECE7" : priority === "Media" ? "#FAEEDA" : "#E1F5EE"}
    color={priorityColor[priority]} />
);

export default function App() {
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterPriority, setFilterPriority] = useState("Todos");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: "", desc: "", category: CATEGORIES[0], priority: "Media" });
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: u, error: e1 }, { data: t, error: e2 }, { data: h, error: e3 }] = await Promise.all([
      supabase.from("users").select("*").order("id"),
      supabase.from("tickets").select("*").order("id", { ascending: false }),
      supabase.from("ticket_history").select("*").order("created_at"),
    ]);
    console.log("users:", u, e1);
    console.log("tickets:", t, e2);
    console.log("history:", h, e3);
    setUsers(u || []);
    setTickets(t || []);
    setHistory(h || []);
    if (u && u.length > 0) setCurrentUser(u[0]);
    setLoading(false);
  };

  const visibleTickets = useMemo(() => {
    if (!currentUser) return [];
    let t = tickets;
    if (currentUser.role === "user") t = t.filter(x => x.created_by === currentUser.id);
    if (currentUser.role === "tech") t = t.filter(x => x.assigned_to === currentUser.id || x.assigned_to === null);
    if (filterStatus !== "Todos") t = t.filter(x => x.status === filterStatus);
    if (filterPriority !== "Todos") t = t.filter(x => x.priority === filterPriority);
    return t;
  }, [tickets, currentUser, filterStatus, filterPriority]);

  const stats = useMemo(() => {
    if (!currentUser) return { total: 0, abiertos: 0, enProgreso: 0, resueltos: 0 };
    const base = currentUser.role === "user" ? tickets.filter(x => x.created_by === currentUser.id) : tickets;
    return {
      total: base.length,
      abiertos: base.filter(x => x.status === "Abierto").length,
      enProgreso: base.filter(x => x.status === "En progreso").length,
      resueltos: base.filter(x => x.status === "Resuelto" || x.status === "Cerrado").length,
    };
  }, [tickets, currentUser]);

  const ticketHistory = (id) => history.filter(h => h.ticket_id === id);

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) return;
    const now = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase.from("tickets").insert([{
      title: newTicket.title, description: newTicket.desc, category: newTicket.category,
      priority: newTicket.priority, status: "Abierto", created_by: currentUser.id,
      assigned_to: null, created_at: now,
    }]).select().single();
    if (data) {
      await supabase.from("ticket_history").insert([{ ticket_id: data.id, user_name: currentUser.name, action: "Ticket creado" }]);
      setNewTicket({ title: "", desc: "", category: CATEGORIES[0], priority: "Media" });
      setShowNewForm(false);
      await loadAll();
    }
  };

  const updateTicket = async (id, changes, action) => {
    await supabase.from("tickets").update(changes).eq("id", id);
    await supabase.from("ticket_history").insert([{ ticket_id: id, user_name: currentUser.name, action }]);
    await loadAll();
    if (selectedTicket?.id === id) setSelectedTicket(tickets.find(t => t.id === id));
  };

  const addComment = async (id) => {
    if (!comment.trim()) return;
    await supabase.from("ticket_history").insert([{ ticket_id: id, user_name: currentUser.name, action: `Comentario: "${comment}"` }]);
    setComment("");
    await loadAll();
  };

  const sel = selectedTicket ? tickets.find(t => t.id === selectedTicket.id) : null;
  const navStyle = (v) => ({
    padding: "8px 14px", background: view === v ? "#E6F1FB" : "transparent",
    color: view === v ? "#0C447C" : "#555", border: "none", borderRadius: 6,
    cursor: "pointer", fontWeight: view === v ? 500 : 400, fontSize: 14,
    display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
  });

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Cargando...</div>;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#222", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#185FA5", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
        <span style={{ color: "#fff", fontWeight: 500, fontSize: 16 }}>🎫 Mesa de Ayuda</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#B5D4F4", fontSize: 12 }}>Usuario:</span>
          <select value={currentUser?.id} onChange={e => { setCurrentUser(users.find(u => u.id === parseInt(e.target.value))); setView("dashboard"); setSelectedTicket(null); }}
            style={{ background: "#0C447C", color: "#fff", border: "1px solid #378ADD", borderRadius: 4, padding: "3px 6px", fontSize: 13, cursor: "pointer" }}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLES[u.role]})</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>
        {/* Sidebar */}
        <div style={{ width: 190, borderRight: "1px solid #eee", padding: "16px 10px", display: "flex", flexDirection: "column", gap: 4, background: "#fafafa" }}>
          <button style={navStyle("dashboard")} onClick={() => { setView("dashboard"); setSelectedTicket(null); }}>📊 Dashboard</button>
          <button style={navStyle("tickets")} onClick={() => { setView("tickets"); setSelectedTicket(null); }}>🎫 Tickets</button>
          {currentUser?.role === "admin" && (
            <button style={navStyle("reportes")} onClick={() => { setView("reportes"); setSelectedTicket(null); }}>📈 Reportes</button>
          )}
          <div style={{ marginTop: "auto", padding: "10px 6px", borderTop: "1px solid #eee" }}>
            <Avatar initials={currentUser?.avatar} size={28} />
            <div style={{ fontSize: 12, marginTop: 6, color: "#666" }}>{currentUser?.name}</div>
            <div style={{ fontSize: 11, color: "#378ADD" }}>{ROLES[currentUser?.role]}</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: 20, overflowY: "auto", background: "#fff" }}>

          {/* DASHBOARD */}
          {view === "dashboard" && !selectedTicket && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 16px" }}>Dashboard</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                {[["Total tickets", stats.total, "#E6F1FB", "#0C447C"], ["Abiertos", stats.abiertos, "#FAEEDA", "#633806"], ["En progreso", stats.enProgreso, "#E1F5EE", "#085041"], ["Resueltos/Cerrados", stats.resueltos, "#F1EFE8", "#444441"]].map(([label, val, bg, col]) => (
                  <div key={label} style={{ background: bg, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, color: col, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 500, color: col }}>{val}</div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>Tickets recientes</h3>
              {tickets.slice(0, 5).map(t => {
                const creator = users.find(u => u.id === t.created_by);
                return (
                  <div key={t.id} onClick={() => { setSelectedTicket(t); setView("tickets"); }}
                    style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "10px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar initials={creator?.avatar} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{t.category} · {t.created_at}</div>
                    </div>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                );
              })}
            </div>
          )}

          {/* TICKETS LIST */}
          {view === "tickets" && !selectedTicket && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Tickets</h2>
                {(currentUser?.role === "user" || currentUser?.role === "admin") && (
                  <button onClick={() => setShowNewForm(true)} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>+ Nuevo ticket</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                  <option>Todos</option>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                  <option>Todos</option>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              {showNewForm && (
                <div style={{ background: "#f8f8f8", border: "1px solid #eee", borderRadius: 8, padding: 16, marginBottom: 14 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Nuevo ticket</h3>
                  <input placeholder="Título del problema *" value={newTicket.title} onChange={e => setNewTicket({ ...newTicket, title: e.target.value })}
                    style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, boxSizing: "border-box" }} />
                  <textarea placeholder="Descripción detallada" value={newTicket.desc} onChange={e => setNewTicket({ ...newTicket, desc: e.target.value })}
                    style={{ width: "100%", height: 60, marginBottom: 8, resize: "vertical", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 14, fontFamily: "system-ui", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <select value={newTicket.category} onChange={e => setNewTicket({ ...newTicket, category: e.target.value })} style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <select value={newTicket.priority} onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })} style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleCreateTicket} style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>Crear ticket</button>
                    <button onClick={() => setShowNewForm(false)} style={{ background: "transparent", border: "1px solid #ccc", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                  </div>
                </div>
              )}

              {visibleTickets.length === 0 && <div style={{ color: "#888", fontSize: 14, padding: 20, textAlign: "center" }}>No hay tickets para mostrar.</div>}
              {visibleTickets.map(t => {
                const creator = users.find(u => u.id === t.created_by);
                const assignee = users.find(u => u.id === t.assigned_to);
                return (
                  <div key={t.id} onClick={() => setSelectedTicket(t)}
                    style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "12px 16px", marginBottom: 8, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Avatar initials={creator?.avatar} size={32} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>#{t.id} {t.title}</span>
                          <StatusBadge status={t.status} />
                          <PriorityBadge priority={t.priority} />
                        </div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                          {t.category} · Creado por {creator?.name} · {t.created_at}
                          {assignee && <span> · Asignado a <strong>{assignee.name}</strong></span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TICKET DETAIL */}
          {view === "tickets" && sel && (
            <div>
              <button onClick={() => setSelectedTicket(null)} style={{ background: "transparent", border: "none", color: "#378ADD", cursor: "pointer", fontSize: 13, marginBottom: 14, padding: 0 }}>← Volver a tickets</button>
              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 20, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>#{sel.id} {sel.title}</h2>
                  <div style={{ display: "flex", gap: 6 }}><StatusBadge status={sel.status} /><PriorityBadge priority={sel.priority} /></div>
                </div>
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 14px" }}>{sel.description}</p>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#888", flexWrap: "wrap" }}>
                  <span>📁 {sel.category}</span>
                  <span>📅 {sel.created_at}</span>
                  <span>👤 {users.find(u => u.id === sel.created_by)?.name}</span>
                  <span>🔧 {users.find(u => u.id === sel.assigned_to)?.name || "Sin asignar"}</span>
                </div>
              </div>

              {(currentUser?.role === "admin" || currentUser?.role === "tech") && (
                <div style={{ background: "#f8f8f8", border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Acciones</h3>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#888" }}>Estado</label>
                      <select value={sel.status} onChange={e => updateTicket(sel.id, { status: e.target.value }, `Estado cambiado a ${e.target.value}`)}
                        style={{ display: "block", marginTop: 4, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {currentUser?.role === "admin" && (
                      <div>
                        <label style={{ fontSize: 12, color: "#888" }}>Asignar a</label>
                        <select value={sel.assigned_to ?? ""} onChange={e => {
                          const uid = e.target.value ? parseInt(e.target.value) : null;
                          const name = uid ? users.find(u => u.id === uid)?.name : "Sin asignar";
                          updateTicket(sel.id, { assigned_to: uid }, `Asignado a ${name}`);
                        }} style={{ display: "block", marginTop: 4, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid #ddd" }}>
                          <option value="">Sin asignar</option>
                          {users.filter(u => u.role === "tech").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Agregar comentario</h3>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribí tu comentario..."
                  style={{ width: "100%", height: 56, resize: "vertical", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box" }} />
                <button onClick={() => addComment(sel.id)} style={{ marginTop: 8, background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Comentar</button>
              </div>

              <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 14 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500 }}>Historial</h3>
                {ticketHistory(sel.id).map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#378ADD", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: "#888" }}>{new Date(h.created_at).toLocaleDateString()}</span>
                      <span style={{ marginLeft: 8 }}><strong>{h.user_name}</strong> — {h.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REPORTES */}
          {view === "reportes" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 18px" }}>Reportes</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["Tickets por estado", STATUSES, s => tickets.filter(t => t.status === s).length, statusColor],
                  ["Tickets por prioridad", PRIORITIES, p => tickets.filter(t => t.priority === p).length, priorityColor],
                ].map(([title, items, countFn, colors]) => (
                  <div key={title} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>{title}</h3>
                    {items.map(item => {
                      const count = countFn(item);
                      const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0;
                      return (
                        <div key={item} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                            <span>{item}</span><span style={{ fontWeight: 500 }}>{count}</span>
                          </div>
                          <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8 }}>
                            <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: colors[item] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Tickets por técnico</h3>
                  {users.filter(u => u.role === "tech").map(u => {
                    const count = tickets.filter(t => t.assigned_to === u.id).length;
                    const pct = tickets.length ? Math.round((count / tickets.length) * 100) : 0;
                    return (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <Avatar initials={u.avatar} size={28} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13 }}>{u.name}</div>
                          <div style={{ background: "#f0f0f0", borderRadius: 4, height: 6, marginTop: 3 }}>
                            <div style={{ width: `${pct}%`, height: 6, borderRadius: 4, background: "#1D9E75" }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 500 }}>Tickets por categoría</h3>
                  {CATEGORIES.map(c => {
                    const count = tickets.filter(t => t.category === c).length;
                    if (!count) return null;
                    const pct = Math.round((count / tickets.length) * 100);
                    return (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                          <span>{c}</span><span style={{ fontWeight: 500 }}>{count}</span>
                        </div>
                        <div style={{ background: "#f0f0f0", borderRadius: 4, height: 8 }}>
                          <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: "#185FA5" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}