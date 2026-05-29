import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API = "https://multi-ia-alexa-backend.onrender.com";

type ViewMode = "chat" | "history" | "alexa" | "survey";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [view, setView] = useState<ViewMode>("chat");
  const [ia, setIa] = useState("auto");
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [alexaStatus, setAlexaStatus] = useState<any>(null);
  const [surveyStatus, setSurveyStatus] = useState<any>(null);

  const [surveyClarity, setSurveyClarity] = useState(5);
  const [surveyCompleteness, setSurveyCompleteness] = useState(5);
  const [surveyUsefulness, setSurveyUsefulness] = useState(5);
  const [surveyPreferred, setSurveyPreferred] = useState(true);
  const [surveyBestAi, setSurveyBestAi] = useState("auto");
  const [surveyComments, setSurveyComments] = useState("");

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const savedToken = await AsyncStorage.getItem("token");

      if (savedToken) {
        setToken(savedToken);
        await loadDashboard(savedToken);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  function authHeaders(authToken = token, json = false) {
    const headers: any = {
      Authorization: authToken || "",
    };

    if (json) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  async function login() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Faltan datos", "Escribe usuario/email y contraseña.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!data.token) {
        Alert.alert("Error", data.error || "No se pudo iniciar sesión.");
        return;
      }

      await AsyncStorage.setItem("token", data.token);
      setToken(data.token);
      await loadDashboard(data.token);
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function register() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Faltan datos", "Escribe usuario/email y contraseña.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert("Listo", "Usuario creado. Ahora inicia sesión.");
      } else {
        Alert.alert("Error", data.error || "No se pudo crear usuario.");
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function logout() {
    await AsyncStorage.removeItem("token");
    setToken(null);
    setChatMessages([]);
    setConversations([]);
    setAlexaStatus(null);
    setConversationId(null);
    setView("chat");
  }

  async function loadDashboard(authToken = token) {
    if (!authToken) return;

    await Promise.all([
      loadAlexaStatus(authToken),
      loadConversations(authToken),
      loadSurveyStatus(authToken),
    ]);
  }

  async function loadAlexaStatus(authToken = token) {
    if (!authToken) return;

    try {
      const res = await fetch(`${API}/alexa/status`, {
        headers: authHeaders(authToken),
      });

      const data = await res.json();
      setAlexaStatus(data);
    } catch (error) {
      console.log("Alexa status error", error);
    }
  }

  async function loadConversations(authToken = token) {
    if (!authToken) return;

    try {
      const res = await fetch(`${API}/conversaciones`, {
        headers: authHeaders(authToken),
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setConversations(data);
      }
    } catch (error) {
      console.log("Conversations error", error);
    }
  }

  async function loadSurveyStatus(authToken = token) {
    if (!authToken) return;

    try {
      const res = await fetch(`${API}/survey/status`, {
        headers: authHeaders(authToken),
      });

      const data = await res.json();
      setSurveyStatus(data);
    } catch (error) {
      console.log("Survey status error", error);
    }
  }

  async function submitSurvey() {
    setWorking(true);

    try {
      const res = await fetch(`${API}/survey/submit`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          clarity: surveyClarity,
          completeness: surveyCompleteness,
          usefulness: surveyUsefulness,
          preferred_use: surveyPreferred,
          best_ai: surveyBestAi,
          comments: surveyComments.trim(),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert("Gracias", "Tu encuesta fue guardada correctamente.");
        setSurveyComments("");
        await loadSurveyStatus();
        setView("chat");
      } else {
        Alert.alert("Error", data.error || "No se pudo guardar la encuesta.");
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function dismissSurvey() {
    setWorking(true);

    try {
      const res = await fetch(`${API}/survey/dismiss`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert("Listo", "La encuesta se pospuso por 7 días.");
        await loadSurveyStatus();
        setView("chat");
      } else {
        Alert.alert("Error", data.error || "No se pudo posponer.");
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function generateAlexaCode() {
    setWorking(true);

    try {
      const res = await fetch(`${API}/alexa/generate-code`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert(
          "Código Alexa",
          `Tu código es ${data.code}. Dile a Alexa: mi código es ${data.code}`
        );
        await loadAlexaStatus();
      } else {
        Alert.alert("Error", data.error || "No se pudo generar código.");
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function unlinkAlexa() {
    Alert.alert("Desvincular Alexa", "¿Seguro que quieres desvincular Alexa?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desvincular",
        style: "destructive",
        onPress: async () => {
          setWorking(true);

          try {
            const res = await fetch(`${API}/alexa/unlink`, {
              method: "DELETE",
              headers: authHeaders(),
            });

            const data = await res.json();

            if (data.ok) {
              Alert.alert("Listo", "Alexa desvinculada.");
              await loadAlexaStatus();
            } else {
              Alert.alert("Error", data.error || "No se pudo desvincular.");
            }
          } catch (error) {
            Alert.alert("Error", "No se pudo conectar con el servidor.");
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }

  async function sendMessage() {
    const text = message.trim();

    if (!text) return;

    const userMsg = {
      role: "user",
      mensaje: text,
      source: "mobile",
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setWorking(true);

    try {
      const res = await fetch(`${API}/preguntar`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          mensaje: text,
          ia,
          conversation_id: conversationId,
          source: "mobile",
        }),
      });

      const data = await res.json();

      if (data.error) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            mensaje: data.error,
            ia: "error",
            source: "mobile",
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      setConversationId(data.conversation_id);

      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          mensaje: data.respuesta,
          ia: data.ia,
          source: data.source || "mobile",
          created_at: new Date().toISOString(),
        },
      ]);

      await loadConversations();
      await loadSurveyStatus();
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          mensaje: "No se pudo conectar con el servidor.",
          ia: "error",
          source: "mobile",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setWorking(false);
    }
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setView("chat");
    setWorking(true);

    try {
      const res = await fetch(`${API}/historial/${id}`, {
        headers: authHeaders(),
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setChatMessages(data);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo cargar el historial.");
    } finally {
      setWorking(false);
    }
  }

  function newChat() {
    setConversationId(null);
    setChatMessages([]);
    setView("chat");
  }

  function getSourceLabel(source: string) {
    if (source === "alexa") return "🔊 Alexa";
    if (source === "mobile") return "📱 Móvil";
    return "🌐 Web";
  }

  function getIaLabel(value: string) {
    const labels: any = {
      auto: "Auto",
      chatgpt: "ChatGPT",
      groq_fast: "Groq rápido",
      groq_power: "Groq potente",
      gemini: "Gemini",
      error: "Error",
    };

    return labels[value] || value || "IA";
  }

  function formatDate(value: string) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function renderScoreSelector(
    label: string,
    value: number,
    setter: (value: number) => void
  ) {
    return (
      <View style={styles.surveyBlock}>
        <Text style={styles.cardLabel}>{label}</Text>

        <View style={styles.scoreRow}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Pressable
              key={score}
              style={[
                styles.scoreButton,
                value === score && styles.scoreButtonActive,
              ]}
              onPress={() => setter(score)}
            >
              <Text
                style={[
                  styles.scoreText,
                  value === score && styles.scoreTextActive,
                ]}
              >
                {score}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Cargando Laboratorio Naranja...</Text>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.login}>
        <View style={styles.loginCard}>
          <Text style={styles.logo}>🍊</Text>
          <Text style={styles.title}>Laboratorio Naranja</Text>
          <Text style={styles.subtitle}>
            Conecta Alexa con IA y consulta tu historial desde el móvil.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email o usuario"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={styles.primaryButton}
            onPress={login}
            disabled={working}
          >
            <Text style={styles.buttonText}>
              {working ? "Cargando..." : "Entrar"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={register}
            disabled={working}
          >
            <Text style={styles.buttonText}>Crear cuenta</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appTitle}>🍊 Laboratorio Naranja</Text>
          <Text style={styles.appSubtitle}>Alexa + Multi IA + Historial</Text>
        </View>

        <Pressable onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.nav}>
        <Pressable
          style={[styles.navBtn, view === "chat" && styles.navActive]}
          onPress={() => setView("chat")}
        >
          <Text style={styles.navText}>Chat</Text>
        </Pressable>

        <Pressable
          style={[styles.navBtn, view === "history" && styles.navActive]}
          onPress={() => setView("history")}
        >
          <Text style={styles.navText}>Historial</Text>
        </Pressable>

        <Pressable
          style={[styles.navBtn, view === "alexa" && styles.navActive]}
          onPress={() => setView("alexa")}
        >
          <Text style={styles.navText}>Alexa</Text>
        </Pressable>

        <Pressable
          style={[styles.navBtn, view === "survey" && styles.navActive]}
          onPress={() => setView("survey")}
        >
          <Text style={styles.navText}>Encuesta</Text>
        </Pressable>
      </View>

      {view === "chat" && (
        <View style={styles.content}>
          <View style={styles.chatHeader}>
            <Pressable style={styles.smallButton} onPress={newChat}>
              <Text style={styles.smallButtonText}>Nuevo</Text>
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {["auto", "chatgpt", "groq_fast", "groq_power", "gemini"].map(
                (item) => (
                  <Pressable
                    key={item}
                    style={[styles.iaChip, ia === item && styles.iaChipActive]}
                    onPress={() => setIa(item)}
                  >
                    <Text style={styles.iaChipText}>{getIaLabel(item)}</Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          </View>

          <ScrollView style={styles.messages}>
            {chatMessages.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  Haz una pregunta desde el móvil
                </Text>
                <Text style={styles.emptyText}>
                  También puedes preguntarle a Alexa y luego ver el historial aquí.
                </Text>
              </View>
            ) : (
              chatMessages.map((item, index) => (
                <View
                  key={`${item.created_at}-${index}`}
                  style={[
                    styles.bubble,
                    item.role === "user" ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {item.role !== "user" && (
                    <Text style={styles.bubbleMeta}>
                      {getIaLabel(item.ia)} · {getSourceLabel(item.source)}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.bubbleText,
                      item.role === "user" && styles.userBubbleText,
                    ]}
                  >
                    {item.mensaje}
                  </Text>

                  <Text
                    style={[
                      styles.timeText,
                      item.role === "user" && styles.userTimeText,
                    ]}
                  >
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.sendBox}>
            <TextInput
              style={styles.messageInput}
              placeholder="Escribe tu pregunta..."
              placeholderTextColor="#64748b"
              value={message}
              onChangeText={setMessage}
              multiline
            />

            <Pressable
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={working}
            >
              <Text style={styles.sendText}>{working ? "..." : "Enviar"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {view === "history" && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Historial</Text>

          <Pressable
            style={styles.refreshButton}
            onPress={() => loadConversations()}
          >
            <Text style={styles.refreshText}>Refrescar historial</Text>
          </Pressable>

          {conversations.length === 0 ? (
            <Text style={styles.mutedText}>No hay conversaciones todavía.</Text>
          ) : (
            conversations.map((item) => (
              <Pressable
                key={item.conversation_id}
                style={styles.historyItem}
                onPress={() => openConversation(item.conversation_id)}
              >
                <Text style={styles.historySource}>
                  {getSourceLabel(item.source)}
                </Text>
                <Text style={styles.historyTitle}>
                  {item.titulo || "Chat sin título"}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {view === "alexa" && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Conexión con Alexa</Text>

          <View style={styles.alexaCard}>
            <Text style={styles.cardLabel}>Estado</Text>
            <Text style={styles.statusText}>
              {alexaStatus?.linked
                ? "✅ Alexa vinculada"
                : "❌ Alexa no vinculada"}
            </Text>

            {alexaStatus?.active_pair_code && (
              <>
                <Text style={styles.cardLabel}>Código temporal</Text>
                <Text style={styles.codeText}>
                  {alexaStatus.active_pair_code.code}
                </Text>
                <Text style={styles.mutedText}>
                  Dile a Alexa: mi código es{" "}
                  {alexaStatus.active_pair_code.code}
                </Text>
              </>
            )}

            <Pressable
              style={styles.primaryButton}
              onPress={generateAlexaCode}
              disabled={working}
            >
              <Text style={styles.buttonText}>Generar código Alexa</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => loadAlexaStatus()}
              disabled={working}
            >
              <Text style={styles.buttonText}>Refrescar estado</Text>
            </Pressable>

            <Pressable
              style={styles.dangerButton}
              onPress={unlinkAlexa}
              disabled={working}
            >
              <Text style={styles.buttonText}>Desvincular Alexa</Text>
            </Pressable>
          </View>

          {surveyStatus?.should_show && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>📊 Encuesta disponible</Text>
              <Text style={styles.mutedText}>
                Ya puedes responder la encuesta desde la pestaña Encuesta.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {view === "survey" && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Encuesta de experiencia</Text>

          <View style={styles.alexaCard}>
            <Text style={styles.statusText}>
              📊 Evaluación de respuestas con IA
            </Text>

            <Text style={styles.mutedText}>
              Esta encuesta ayuda a medir si Alexa mejora al conectarse con
              modelos de inteligencia artificial.
            </Text>

            {surveyStatus?.should_show ? (
              <Text style={styles.surveyHint}>
                La encuesta ya está disponible por uso suficiente.
              </Text>
            ) : (
              <Text style={styles.surveyHint}>
                Puedes responderla en modo prueba. La regla real es después de 3
                días o 8 preguntas por Alexa.
              </Text>
            )}

            {renderScoreSelector(
              "Claridad de las respuestas",
              surveyClarity,
              setSurveyClarity
            )}

            {renderScoreSelector(
              "Qué tan completas fueron",
              surveyCompleteness,
              setSurveyCompleteness
            )}

            {renderScoreSelector(
              "Utilidad general",
              surveyUsefulness,
              setSurveyUsefulness
            )}

            <View style={styles.surveyBlock}>
              <Text style={styles.cardLabel}>
                ¿Preferirías usar Alexa con este sistema?
              </Text>

              <View style={styles.optionRow}>
                <Pressable
                  style={[
                    styles.optionChip,
                    surveyPreferred && styles.optionChipActive,
                  ]}
                  onPress={() => setSurveyPreferred(true)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      surveyPreferred && styles.optionTextActive,
                    ]}
                  >
                    Sí
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.optionChip,
                    !surveyPreferred && styles.optionChipActive,
                  ]}
                  onPress={() => setSurveyPreferred(false)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      !surveyPreferred && styles.optionTextActive,
                    ]}
                  >
                    No
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.surveyBlock}>
              <Text style={styles.cardLabel}>¿Qué IA te gustó más?</Text>

              <View style={styles.optionGrid}>
                {[
                  ["auto", "Auto"],
                  ["chatgpt", "ChatGPT"],
                  ["groq_fast", "Groq rápido"],
                  ["groq_power", "Groq potente"],
                  ["gemini", "Gemini"],
                ].map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.optionChip,
                      surveyBestAi === value && styles.optionChipActive,
                    ]}
                    onPress={() => setSurveyBestAi(value)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        surveyBestAi === value && styles.optionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.surveyBlock}>
              <Text style={styles.cardLabel}>Comentario opcional</Text>

              <TextInput
                style={styles.textArea}
                placeholder="Escribe algún comentario..."
                placeholderTextColor="#64748b"
                value={surveyComments}
                onChangeText={setSurveyComments}
                multiline
              />
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={submitSurvey}
              disabled={working}
            >
              <Text style={styles.buttonText}>
                {working ? "Guardando..." : "Enviar encuesta"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={dismissSurvey}
              disabled={working}
            >
              <Text style={styles.buttonText}>Posponer 7 días</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "white",
    marginTop: 12,
  },
  login: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    padding: 20,
  },
  loginCard: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 22,
  },
  logo: {
    fontSize: 48,
    textAlign: "center",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderWidth: 1,
    color: "white",
    padding: 13,
    borderRadius: 12,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    padding: 13,
    borderRadius: 12,
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#334155",
    padding: 13,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
  },
  dangerButton: {
    backgroundColor: "#7f1d1d",
    padding: 13,
    borderRadius: 12,
    marginTop: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  app: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topBar: {
    backgroundColor: "#020617",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  appSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: {
    color: "white",
    fontWeight: "bold",
  },
  nav: {
    flexDirection: "row",
    backgroundColor: "#111827",
    padding: 8,
    gap: 8,
  },
  navBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1f2937",
  },
  navActive: {
    backgroundColor: "#2563eb",
  },
  navText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  chatHeader: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  smallButton: {
    backgroundColor: "#020617",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  smallButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  iaChip: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    marginRight: 8,
  },
  iaChipActive: {
    backgroundColor: "#2563eb",
  },
  iaChipText: {
    color: "#0f172a",
    fontWeight: "bold",
  },
  messages: {
    flex: 1,
  },
  emptyBox: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 18,
    marginTop: 40,
  },
  emptyTitle: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#0f172a",
  },
  emptyText: {
    color: "#64748b",
    marginTop: 6,
    lineHeight: 20,
  },
  bubble: {
    padding: 13,
    borderRadius: 16,
    marginBottom: 10,
    maxWidth: "88%",
  },
  userBubble: {
    backgroundColor: "#2563eb",
    alignSelf: "flex-end",
  },
  aiBubble: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignSelf: "flex-start",
  },
  bubbleMeta: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "bold",
    marginBottom: 5,
  },
  bubbleText: {
    color: "#0f172a",
    lineHeight: 20,
  },
  userBubbleText: {
    color: "white",
  },
  timeText: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 8,
  },
  userTimeText: {
    color: "#dbeafe",
  },
  sendBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingTop: 10,
  },
  messageInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: "white",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  sendText: {
    color: "white",
    fontWeight: "bold",
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "bold",
    fontSize: 22,
    marginBottom: 10,
  },
  refreshButton: {
    backgroundColor: "#020617",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  refreshText: {
    color: "white",
    fontWeight: "bold",
  },
  mutedText: {
    color: "#64748b",
    lineHeight: 20,
  },
  historyItem: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  historySource: {
    color: "#2563eb",
    fontWeight: "bold",
    marginBottom: 4,
  },
  historyTitle: {
    color: "#0f172a",
  },
  alexaCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardLabel: {
    color: "#64748b",
    fontWeight: "bold",
    marginTop: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 4,
  },
  codeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2563eb",
    letterSpacing: 4,
    marginTop: 4,
  },
  noticeBox: {
    backgroundColor: "#fef3c7",
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  noticeTitle: {
    color: "#92400e",
    fontWeight: "bold",
    marginBottom: 6,
  },
  surveyBlock: {
    marginTop: 14,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  scoreButton: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  scoreButtonActive: {
    backgroundColor: "#2563eb",
  },
  scoreText: {
    color: "#0f172a",
    fontWeight: "bold",
  },
  scoreTextActive: {
    color: "white",
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  optionChip: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  optionChipActive: {
    backgroundColor: "#2563eb",
  },
  optionText: {
    color: "#0f172a",
    fontWeight: "bold",
  },
  optionTextActive: {
    color: "white",
  },
  textArea: {
    minHeight: 90,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
    color: "#0f172a",
    marginTop: 8,
  },
  surveyHint: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    lineHeight: 20,
  },
});