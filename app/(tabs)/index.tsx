import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PlanUsagePanel } from "../../components/plan-usage";
import { usePlanUsage } from "../../hooks/use-plan-usage";
import { AlexaConnection } from "../../components/alexa-connection";
import { getSessionToken, saveSessionToken, clearSessionToken } from "../../lib/session-storage";
import { questionRequestId, clearPendingQuestion } from "../../lib/pending-question";

const API = process.env.EXPO_PUBLIC_API_URL || "https://multi-ia-alexa-backend.onrender.com";
const LOGO = require("../../assets/images/zuneri-logo.png");

type ViewMode = "chat" | "history" | "alexa" | "survey" | "settings" | "plan";
type AuthMode = "login" | "register" | "verify" | "forgot" | "reset";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const { usage, usageLoading, usageError, refreshUsage } = usePlanUsage(API, token);
  const sendingQuestion = useRef(false);
  const activeSession = useRef<string | null>(null);
  function updateSession(next: string | null) {
    activeSession.current = next;
    setToken(next);
  }
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

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
  const [surveyConsent, setSurveyConsent] = useState(false);

  const showSurveyTab = surveyStatus?.reason !== "already_answered";

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const savedToken = await getSessionToken();
      await AsyncStorage.removeItem("nexo_admin_key");

      if (savedToken) {
        updateSession(savedToken);
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

    if (json) headers["Content-Type"] = "application/json";

    return headers;
  }

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function isValidPassword(value: string) {
    return String(value || "").length >= 8;
  }

  function wakeMessage() {
    return "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo más tarde.";
  }

  async function login() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Correo inválido", "Ingresa un correo válido.");
      return;
    }

    if (!password) {
      Alert.alert("Faltan datos", "Escribe tu contraseña.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();

      if (data.token) {
        await saveSessionToken(data.token);
        setPassword("");
        updateSession(data.token);
        await loadDashboard(data.token);
        return;
      }

      if (data.needs_verification) {
        const mail = data.email || cleanEmail;
        setPendingEmail(mail);
        setEmail(mail);
        setCode("");
        setAuthMode("verify");
        Alert.alert("Verifica tu correo", data.error || "Te enviamos un nuevo código.");
        return;
      }

      Alert.alert("Error", data.error || "No se pudo iniciar sesión.");
    } catch (error) {
      Alert.alert("Error", wakeMessage());
    } finally {
      setWorking(false);
    }
  }

  async function register() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Correo inválido", "Ingresa un correo válido.");
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert("Contraseña débil", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      Alert.alert("Aceptación requerida", "Debes aceptar los términos de uso y la política de privacidad para crear tu cuenta.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          accept_terms: acceptTerms,
          accept_privacy: acceptPrivacy,
        }),
      });

      const data = await res.json();

      if (data.ok || data.needs_verification) {
        const mail = data.email || cleanEmail;
        setPendingEmail(mail);
        setEmail(mail);
        setCode("");
        setAuthMode("verify");
        Alert.alert("Verificación", data.message || "Te enviamos un código.");
        return;
      }

      Alert.alert("Error", data.error || "No se pudo crear cuenta.");
    } catch (error) {
      Alert.alert("Error", wakeMessage());
    } finally {
      setWorking(false);
    }
  }

  async function verifyEmail() {
    const cleanEmail = (pendingEmail || email).trim().toLowerCase();

    if (!isValidEmail(cleanEmail) || !code.trim()) {
      Alert.alert("Faltan datos", "Escribe correo y código.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: code.trim() }),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert("Listo", "Correo verificado. Ahora inicia sesión.");
        setAuthMode("login");
        setPassword("");
        setCode("");
        return;
      }

      Alert.alert("Error", data.error || "No se pudo verificar.");
    } catch (error) {
      Alert.alert("Error", wakeMessage());
    } finally {
      setWorking(false);
    }
  }

  async function resendVerification() {
    const cleanEmail = (pendingEmail || email).trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Correo inválido", "Ingresa un correo válido.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      Alert.alert("Código", data.message || "Si aplica, te enviamos un código.");
    } catch (error) {
      Alert.alert("Error", wakeMessage());
    } finally {
      setWorking(false);
    }
  }

  async function forgotPassword() {
    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Correo inválido", "Ingresa un correo válido.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      setPendingEmail(cleanEmail);
      setCode("");
      setNewPassword("");
      setAuthMode("reset");
      Alert.alert("Recuperación", data.message || "Si el correo existe, enviaremos instrucciones.");
    } catch (error) {
      Alert.alert("Error", wakeMessage());
    } finally {
      setWorking(false);
    }
  }

  async function resetPassword() {
    const cleanEmail = (pendingEmail || email).trim().toLowerCase();

    if (!isValidEmail(cleanEmail) || !code.trim()) {
      Alert.alert("Faltan datos", "Escribe correo y código.");
      return;
    }

    if (!isValidPassword(newPassword)) {
      Alert.alert("Contraseña débil", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setWorking(true);

    try {
      const res = await fetch(`${API}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          code: code.trim(),
          password: newPassword,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert("Listo", "Contraseña actualizada. Inicia sesión.");
        setAuthMode("login");
        setPassword("");
        setNewPassword("");
        setCode("");
        return;
      }

      Alert.alert("Error", data.error || "No se pudo actualizar.");
    } catch (error) {
      Alert.alert("Error", wakeMessage());
    } finally {
      setWorking(false);
    }
  }

  async function logout() {
    await clearSessionToken();
    updateSession(null);
    sendingQuestion.current = false;
    setWorking(false);
    if (token) await clearPendingQuestion(token);
    setChatMessages([]);
    setConversations([]);
    setAlexaStatus(null);
    setConversationId(null);
    setView("chat");
    setAuthMode("login");
  }

  async function loadDashboard(authToken = token) {
    if (!authToken) return;

    const account = await fetch(`${API}/me`, { headers: authHeaders(authToken) });
    if (activeSession.current !== authToken) return;
    if (account.status === 401 || account.status === 403) {
      await clearSessionToken();
      updateSession(null);
      setAuthMode("login");
      return;
    }
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
      if (activeSession.current !== authToken) return;
      setAlexaStatus(data);
    } catch (error) {
      if (activeSession.current !== authToken) return;
      setAlexaStatus({ error: "No pudimos consultar la conexión. Intenta actualizar el estado." });
    }
  }

  async function loadConversations(authToken = token) {
    if (!authToken) return;

    try {
      const res = await fetch(`${API}/conversaciones`, {
        headers: authHeaders(authToken),
      });

      const data = await res.json();
      if (activeSession.current !== authToken) return;

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
      if (activeSession.current !== authToken) return;
      setSurveyStatus(data);
    } catch (error) {
      console.log("Survey status error", error);
    }
  }

  async function submitSurvey() {
    if (!surveyConsent) {
      Alert.alert("Consentimiento", "Acepta el uso académico anónimo para enviar la encuesta.");
      return;
    }

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
          consent_academic: surveyConsent,
          source: "mobile",
        }),
      });

      const data = await res.json();

      if (data.ok) {
        Alert.alert("Gracias", "Tu encuesta fue guardada correctamente.");
        setSurveyComments("");
        setSurveyConsent(false);
        await loadSurveyStatus();
        setView("chat");
      } else {
        Alert.alert("Error", data.error || "No se pudo guardar la encuesta.");
      }
    } catch (error) {
      Alert.alert("Error", wakeMessage());
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
      Alert.alert("Error", wakeMessage());
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
            Alert.alert("Error", wakeMessage());
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }

  async function sendMessage() {
    const text = message.trim();

    if (!text || !token || working || sendingQuestion.current) return;
    sendingQuestion.current = true;
    setWorking(true);
    let requestId: string;
    try {
      requestId = await questionRequestId(token, { message: text, model: ia, conversation: conversationId });
    } catch {
      sendingQuestion.current = false;
      setWorking(false);
      Alert.alert("No se pudo preparar la consulta", "Revisa el espacio disponible del dispositivo e intenta de nuevo.");
      return;
    }

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
          request_id: requestId,
          ia,
          conversation_id: conversationId,
          source: "mobile",
        }),
      });

      const data = await res.json();
      if (activeSession.current !== token) return;

      if (data.error) {
        if (["REQUEST_PENDING", "SAVE_PENDING", "PROVIDER_UNKNOWN", "CHAT_UNAVAILABLE"].includes(data.code)) setMessage(text);
        else await clearPendingQuestion(token);
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

      await clearPendingQuestion(token);
      setConversationId(data.conversation_id);

      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          mensaje: data.respuesta,
          id: data.assistant_chat_id,
          ia: data.ia,
          source: data.source || "mobile",
          created_at: new Date().toISOString(),
        },
      ]);

      await loadConversations();
      await loadSurveyStatus();
    } catch (error) {
      if (activeSession.current !== token) return;
      setMessage(text);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          mensaje: wakeMessage(),
          ia: "error",
          source: "mobile",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      if (activeSession.current === token) {
        sendingQuestion.current = false;
        setWorking(false);
        void refreshUsage();
      }
    }
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setView("chat");
    setWorking(true);

    try {
      const res = await fetch(`${API}/historial/${encodeURIComponent(id)}`, {
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

  async function deleteConversation(id: string) {
    Alert.alert("Borrar chat", "¿Seguro que quieres borrar este chat?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          setWorking(true);

          try {
            const res = await fetch(`${API}/conversaciones/${encodeURIComponent(id)}`, {
              method: "DELETE",
              headers: authHeaders(),
            });

            const data = await res.json();

            if (data.ok) {
              if (conversationId === id) newChat();
              await loadConversations();
            } else {
              Alert.alert("Error", data.error || "No se pudo borrar.");
            }
          } catch {
            Alert.alert("Error", wakeMessage());
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }

  async function deleteAllConversations() {
    Alert.alert("Borrar historial", "¿Seguro que quieres borrar todo tu historial visible?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar todo",
        style: "destructive",
        onPress: async () => {
          setWorking(true);

          try {
            const res = await fetch(`${API}/conversaciones`, {
              method: "DELETE",
              headers: authHeaders(),
            });

            const data = await res.json();

            if (data.ok) {
              newChat();
              await loadConversations();
              Alert.alert("Listo", "Historial borrado.");
            } else {
              Alert.alert("Error", data.error || "No se pudo borrar.");
            }
          } catch {
            Alert.alert("Error", wakeMessage());
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  }


  function openLegal(path: string) {
    Linking.openURL(`${API}${path}`).catch(() => {
      Alert.alert("Error", "No se pudo abrir el enlace.");
    });
  }

  async function deleteAccount() {
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción eliminará tu cuenta y datos asociados. ¿Quieres continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              const res = await fetch(`${API}/account`, {
                method: "DELETE",
                headers: authHeaders(),
              });

              const data = await res.json();

              if (data.ok) {
                await clearSessionToken();
                updateSession(null);
                setChatMessages([]);
                setConversations([]);
                Alert.alert("Listo", "Cuenta eliminada correctamente.");
              } else {
                Alert.alert("Error", data.error || "No se pudo eliminar la cuenta.");
              }
            } catch (error) {
              Alert.alert("Error", wakeMessage());
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }

  function reportResponse(chatId: number) {
    async function sendReport(category: string) {
      try {
        const response = await fetch(`${API}/content-reports`, { method: "POST", headers: authHeaders(token, true),
          body: JSON.stringify({ chat_id: chatId, category }) });
        const data = await response.json();
        Alert.alert(response.ok ? "Reporte recibido" : "No se pudo reportar", data.message || data.error || "Intenta de nuevo.");
      } catch { Alert.alert("No se pudo reportar", wakeMessage()); }
    }
    Alert.alert("Reportar respuesta", "Elige el motivo para que el equipo revise esta respuesta.", [
      { text: "Ofensiva o peligrosa", onPress: () => void sendReport("unsafe") },
      { text: "Incorrecta", onPress: () => void sendReport("incorrect") },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function newChat() {
    if (token) void clearPendingQuestion(token);
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

  function renderAuth() {
    return (
      <SafeAreaView style={styles.login}>
        <StatusBar style="light" backgroundColor="#020617" />
        <ScrollView contentContainerStyle={styles.loginScroll}>
          <View style={styles.heroCard}>
            <Image source={LOGO} style={styles.authLogo} />
            <Text style={styles.title}>Zuneri</Text>
            <Text style={styles.subtitle}>
              Voz, web y app conectadas con inteligencia artificial.
            </Text>
          </View>

          <View style={styles.loginCard}>
            {authMode === "login" && (
              <>
                <Text style={styles.formTitle}>Iniciar sesión</Text>
                <Text style={styles.formSubtitle}>
                  Accede a tus conversaciones de Alexa, web y móvil.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Correo"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <Pressable style={styles.primaryButton} onPress={login} disabled={working}>
                  <Text style={styles.buttonText}>{working ? "Cargando..." : "Entrar"}</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => setAuthMode("register")}>
                  <Text style={styles.buttonText}>Crear cuenta</Text>
                </Pressable>

                <View style={styles.authLinks}>
                  <Pressable onPress={() => setAuthMode("forgot")}>
                    <Text style={styles.linkText}>Olvidé mi contraseña</Text>
                  </Pressable>

                  <Pressable onPress={() => setAuthMode("verify")}>
                    <Text style={styles.linkText}>Verificar correo</Text>
                  </Pressable>
                </View>
              </>
            )}

            {authMode === "register" && (
              <>
                <Text style={styles.formTitle}>Crear cuenta</Text>
                <Text style={styles.formSubtitle}>
                  Usa un correo real. Te enviaremos un código de verificación.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Correo"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Contraseña de mínimo 8 caracteres"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <Pressable style={styles.consentBox} onPress={() => setAcceptTerms(!acceptTerms)}>
                  <Text style={styles.consentText}>{acceptTerms ? "☑" : "☐"} Acepto los términos de uso.</Text>
                </Pressable>
                <Pressable style={styles.consentBox} onPress={() => setAcceptPrivacy(!acceptPrivacy)}>
                  <Text style={styles.consentText}>{acceptPrivacy ? "☑" : "☐"} Acepto la política de privacidad.</Text>
                </Pressable>

                <View style={styles.authLinks}>
                  <Pressable onPress={() => openLegal("/terms")}>
                    <Text style={styles.linkText}>Leer términos</Text>
                  </Pressable>
                  <Pressable onPress={() => openLegal("/privacy")}>
                    <Text style={styles.linkText}>Leer privacidad</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.primaryButton} onPress={register} disabled={working}>
                  <Text style={styles.buttonText}>{working ? "Creando..." : "Crear cuenta"}</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => setAuthMode("login")}>
                  <Text style={styles.buttonText}>Ya tengo cuenta</Text>
                </Pressable>
              </>
            )}

            {authMode === "verify" && (
              <>
                <Text style={styles.formTitle}>Verificar correo</Text>
                <Text style={styles.formSubtitle}>
                  Ingresa el código enviado. En pruebas, aparece en logs si MAIL_MODE=console.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Correo"
                  placeholderTextColor="#94a3b8"
                  value={pendingEmail || email}
                  onChangeText={(value) => {
                    setPendingEmail(value);
                    setEmail(value);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Código de 6 dígitos"
                  placeholderTextColor="#94a3b8"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                />

                <Pressable style={styles.primaryButton} onPress={verifyEmail} disabled={working}>
                  <Text style={styles.buttonText}>Verificar</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={resendVerification} disabled={working}>
                  <Text style={styles.buttonText}>Reenviar código</Text>
                </Pressable>

                <Pressable style={styles.ghostButton} onPress={() => setAuthMode("login")}>
                  <Text style={styles.linkText}>Volver a login</Text>
                </Pressable>
              </>
            )}

            {authMode === "forgot" && (
              <>
                <Text style={styles.formTitle}>Recuperar contraseña</Text>
                <Text style={styles.formSubtitle}>
                  Te enviaremos un código si el correo está registrado.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Correo"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Pressable style={styles.primaryButton} onPress={forgotPassword} disabled={working}>
                  <Text style={styles.buttonText}>Enviar código</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => setAuthMode("login")}>
                  <Text style={styles.buttonText}>Volver</Text>
                </Pressable>
              </>
            )}

            {authMode === "reset" && (
              <>
                <Text style={styles.formTitle}>Nueva contraseña</Text>
                <Text style={styles.formSubtitle}>
                  Usa el código recibido para crear una contraseña nueva.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Correo"
                  placeholderTextColor="#94a3b8"
                  value={pendingEmail || email}
                  onChangeText={(value) => {
                    setPendingEmail(value);
                    setEmail(value);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Código"
                  placeholderTextColor="#94a3b8"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Nueva contraseña"
                  placeholderTextColor="#94a3b8"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />

                <Pressable style={styles.primaryButton} onPress={resetPassword} disabled={working}>
                  <Text style={styles.buttonText}>Actualizar contraseña</Text>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={() => setAuthMode("login")}>
                  <Text style={styles.buttonText}>Volver a login</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.legalRow}>
            <Pressable onPress={() => openLegal("/privacy")}><Text style={styles.legalLink}>Privacidad</Text></Pressable>
            <Pressable onPress={() => openLegal("/terms")}><Text style={styles.legalLink}>Términos</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="light" backgroundColor="#020617" />
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Cargando Zuneri...</Text>
      </SafeAreaView>
    );
  }

  if (!token) {
    return renderAuth();
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" backgroundColor="#020617" />
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logoMini} />
          <View>
            <Text style={styles.appTitle}>Zuneri</Text>
            <Text style={styles.appSubtitle}>Alexa + Web + App + IA</Text>
          </View>
        </View>

        <Pressable onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nav}>
        <Pressable style={[styles.navBtn, view === "chat" && styles.navActive]} onPress={() => setView("chat")}>
          <Text style={styles.navText}>Chat</Text>
        </Pressable>

        <Pressable style={[styles.navBtn, view === "history" && styles.navActive]} onPress={() => setView("history")}>
          <Text style={styles.navText}>Historial</Text>
        </Pressable>

        <Pressable style={[styles.navBtn, view === "alexa" && styles.navActive]} onPress={() => setView("alexa")}>
          <Text style={styles.navText}>Alexa</Text>
        </Pressable>

        {showSurveyTab && (
          <Pressable style={[styles.navBtn, view === "survey" && styles.navActive]} onPress={() => setView("survey")}>
            <Text style={styles.navText}>Encuesta</Text>
          </Pressable>
        )}

        <Pressable accessibilityRole="button" style={[styles.navBtn, view === "plan" && styles.navActive]}
          onPress={() => { setView("plan"); void refreshUsage(); }}>
          <Text style={styles.navText}>Mi plan</Text>
        </Pressable>

        <Pressable style={[styles.navBtn, view === "settings" && styles.navActive]} onPress={() => setView("settings")}>
          <Text style={styles.navText}>Ajustes</Text>
        </Pressable>
      </ScrollView>

      {view === "chat" && (
        <View style={styles.content}>
          <View style={styles.chatHeader}>
            <Pressable style={styles.smallButton} onPress={newChat} disabled={working}>
              <Text style={styles.smallButtonText}>Nuevo</Text>
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {["auto", "chatgpt", "groq_fast", "groq_power", "gemini"].map((item) => (
                <Pressable
                  key={item}
                  style={[styles.iaChip, ia === item && styles.iaChipActive]}
                  accessibilityState={{ disabled: Boolean(usage && item !== "auto" && !usage.allowed_models.some(model => model.id === item)) }}
                  disabled={Boolean(usage && item !== "auto" && !usage.allowed_models.some(model => model.id === item))}
                  onPress={() => setIa(item)}
                >
                  <Text style={[styles.iaChipText, ia === item && styles.iaChipTextActive]}>{getIaLabel(item)}{usage && item !== "auto" && !usage.allowed_models.some(model => model.id === item) ? " · Pro" : ""}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <ScrollView style={styles.messages}>
            {chatMessages.length === 0 ? (
              <View style={styles.emptyBox}>
                <Image source={LOGO} style={styles.emptyLogo} />
                <Text style={styles.emptyTitle}>Pregunta desde Zuneri</Text>
                <Text style={styles.emptyText}>
                  También puedes usar Alexa diciendo: “Alexa, abre zuneri inteligente”.
                </Text>
              </View>
            ) : (
              chatMessages.map((item, index) => (
                <View
                  key={`${item.created_at}-${index}`}
                  style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}
                >
                  {item.role !== "user" && (
                    <Text style={styles.bubbleMeta}>
                      {getIaLabel(item.ia)} · {getSourceLabel(item.source)}
                    </Text>
                  )}

                  <Text style={[styles.bubbleText, item.role === "user" && styles.userBubbleText]}>
                    {item.mensaje}
                  </Text>

                  {item.role !== "user" && Number.isSafeInteger(item.id) && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Reportar esta respuesta" onPress={() => reportResponse(item.id)}>
                      <Text style={{ color: "#475569", fontSize: 12, marginTop: 12 }}>Reportar respuesta</Text>
                    </Pressable>
                  )}

                  <Text style={[styles.timeText, item.role === "user" && styles.userTimeText]}>
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

            <Pressable style={styles.sendButton} onPress={sendMessage} disabled={working}>
              <Text style={styles.sendText}>{working ? "..." : "Enviar"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {view === "history" && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Historial</Text>

          <View style={styles.rowActions}>
            <Pressable style={styles.refreshButton} onPress={() => loadConversations()}>
              <Text style={styles.refreshText}>Refrescar</Text>
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={deleteAllConversations}>
              <Text style={styles.refreshText}>Borrar todo</Text>
            </Pressable>
          </View>

          {conversations.length === 0 ? (
            <Text style={styles.mutedText}>No hay conversaciones todavía.</Text>
          ) : (
            conversations.map((item) => (
              <View key={item.conversation_id} style={styles.historyItem}>
                <Pressable onPress={() => openConversation(item.conversation_id)} style={{ flex: 1 }}>
                  <Text style={styles.historySource}>{getSourceLabel(item.source)}</Text>
                  <Text style={styles.historyTitle}>{item.titulo || "Chat sin título"}</Text>
                </Pressable>

                <Pressable style={styles.historyDelete} onPress={() => deleteConversation(item.conversation_id)}>
                  <Text style={styles.historyDeleteText}>Borrar</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {view === "alexa" && (
        <ScrollView style={styles.content}>
          <AlexaConnection status={alexaStatus} refresh={() => loadAlexaStatus()} unlink={unlinkAlexa} working={working} />
        </ScrollView>
      )}

      {view === "survey" && showSurveyTab && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Encuesta de experiencia</Text>

          <View style={styles.card}>
            <Text style={styles.statusText}>📊 Evaluación de Zuneri</Text>

            <Text style={styles.mutedText}>
              Esta encuesta ayuda a medir si Alexa mejora al conectarse con modelos de IA.
            </Text>

            {surveyStatus?.should_show ? (
              <Text style={styles.surveyHint}>La encuesta ya está disponible por uso suficiente.</Text>
            ) : (
              <Text style={styles.surveyHint}>
                Puedes responderla en modo prueba. La regla real es después de 3 días o 8 preguntas por Alexa.
              </Text>
            )}

            {renderScoreSelector("Claridad de las respuestas", surveyClarity, setSurveyClarity)}
            {renderScoreSelector("Qué tan completas fueron", surveyCompleteness, setSurveyCompleteness)}
            {renderScoreSelector("Utilidad general", surveyUsefulness, setSurveyUsefulness)}

            <View style={styles.surveyBlock}>
              <Text style={styles.cardLabel}>¿Preferirías usar Alexa con Zuneri?</Text>

              <View style={styles.optionRow}>
                <Pressable
                  style={[styles.optionChip, surveyPreferred && styles.optionChipActive]}
                  onPress={() => setSurveyPreferred(true)}
                >
                  <Text style={[styles.optionText, surveyPreferred && styles.optionTextActive]}>Sí</Text>
                </Pressable>

                <Pressable
                  style={[styles.optionChip, !surveyPreferred && styles.optionChipActive]}
                  onPress={() => setSurveyPreferred(false)}
                >
                  <Text style={[styles.optionText, !surveyPreferred && styles.optionTextActive]}>No</Text>
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
                    style={[styles.optionChip, surveyBestAi === value && styles.optionChipActive]}
                    onPress={() => setSurveyBestAi(value)}
                  >
                    <Text style={[styles.optionText, surveyBestAi === value && styles.optionTextActive]}>
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

            <Pressable style={styles.consentBox} onPress={() => setSurveyConsent(!surveyConsent)}>
              <Text style={styles.consentText}>{surveyConsent ? "☑" : "☐"} Acepto que mis respuestas se usen de forma anónima con fines académicos y de mejora del sistema Zuneri.</Text>
            </Pressable>

            <Pressable style={styles.primaryButton} onPress={submitSurvey} disabled={working}>
              <Text style={styles.buttonText}>{working ? "Guardando..." : "Enviar encuesta"}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={dismissSurvey} disabled={working}>
              <Text style={styles.buttonText}>Posponer 7 días</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {view === "plan" && (
        <ScrollView style={styles.content}>
          <PlanUsagePanel usage={usage} loading={usageLoading} error={usageError} refresh={refreshUsage} />
        </ScrollView>
      )}

      {view === "settings" && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Ajustes y privacidad</Text>
          <View style={[styles.card, styles.settingsCard]}>
            <Text style={styles.statusText}>Cuenta Zuneri</Text>
            <Text style={styles.mutedText}>Consulta documentos legales o elimina tu cuenta si ya no deseas usar el servicio.</Text>
            <Pressable style={styles.legalButton} onPress={() => openLegal("/privacy")}>
              <Text style={styles.legalButtonText}>Política de privacidad</Text>
            </Pressable>
            <Pressable style={styles.legalButton} onPress={() => openLegal("/terms")}>
              <Text style={styles.legalButtonText}>Términos de uso</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={deleteAccount} disabled={working}>
              <Text style={styles.buttonText}>Eliminar mi cuenta</Text>
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
  },
  loginScroll: {
    padding: 18,
    paddingTop: 32,
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
    alignItems: "center",
  },
  authLogo: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: "white",
    marginBottom: 10,
  },
  loginCard: {
    backgroundColor: "#111827",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  title: {
    color: "white",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  formTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },
  formSubtitle: {
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderWidth: 1,
    color: "white",
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    padding: 13,
    borderRadius: 14,
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#334155",
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
  },
  dangerButton: {
    backgroundColor: "#7f1d1d",
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
  },
  ghostButton: {
    marginTop: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "900",
  },
  linkText: {
    color: "#7dd3fc",
    fontWeight: "900",
  },
  authLinks: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 16,
    flexWrap: "wrap",
  },
  legalLink: {
    color: "#7dd3fc",
    fontWeight: "900",
    fontSize: 12,
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
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMini: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "white",
  },
  appTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
  },
  appSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
  },
  logoutButton: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  logoutText: {
    color: "white",
    fontWeight: "900",
  },
  nav: {
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 8,
    maxHeight: 58,
  },
  navBtn: {
    minWidth: 96,
    padding: 10,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#1f2937",
    marginRight: 8,
  },
  navActive: {
    backgroundColor: "#2563eb",
  },
  navText: {
    color: "white",
    fontWeight: "900",
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
    borderRadius: 12,
  },
  smallButtonText: {
    color: "white",
    fontWeight: "900",
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
    fontWeight: "900",
  },
  iaChipTextActive: {
    color: "white",
  },
  messages: {
    flex: 1,
  },
  emptyBox: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 20,
    marginTop: 40,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyLogo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    marginBottom: 10,
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 19,
    color: "#0f172a",
  },
  emptyText: {
    color: "#64748b",
    marginTop: 6,
    lineHeight: 20,
    textAlign: "center",
  },
  bubble: {
    padding: 13,
    borderRadius: 18,
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
    fontWeight: "900",
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
    borderRadius: 16,
    padding: 12,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  sendText: {
    color: "white",
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 24,
    marginBottom: 10,
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#7f1d1d",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  refreshText: {
    color: "white",
    fontWeight: "900",
  },
  mutedText: {
    color: "#64748b",
    lineHeight: 20,
  },
  successText: {
    color: "#16a34a",
    fontWeight: "900",
    marginTop: 10,
  },
  historyItem: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  historySource: {
    color: "#2563eb",
    fontWeight: "900",
    marginBottom: 4,
  },
  historyTitle: {
    color: "#0f172a",
  },
  historyDelete: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  historyDeleteText: {
    color: "#991b1b",
    fontWeight: "900",
  },
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  settingsCard: {
    marginBottom: 14,
    borderColor: "#dbe3f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  legalButton: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
    borderWidth: 1,
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
  },
  legalButtonText: {
    color: "#312e81",
    fontWeight: "900",
  },
  settingsInput: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    color: "#0f172a",
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
  },
  researchButton: {
    backgroundColor: "#ecfeff",
    borderColor: "#67e8f9",
    borderWidth: 1,
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
  },
  researchButtonText: {
    color: "#155e75",
    fontWeight: "900",
  },
  cardLabel: {
    color: "#64748b",
    fontWeight: "900",
    marginTop: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginTop: 4,
  },
  codeText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#2563eb",
    letterSpacing: 4,
    marginTop: 4,
  },
  helpBox: {
    color: "#075985",
    backgroundColor: "#e0f2fe",
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    lineHeight: 20,
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
    fontWeight: "900",
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
    fontWeight: "900",
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

  consentBox: {
    backgroundColor: "#e0f2fe",
    borderColor: "#7dd3fc",
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  consentText: {
    color: "#075985",
    fontWeight: "800",
    lineHeight: 20,
  },
  surveyHint: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 14,
    marginTop: 12,
    lineHeight: 20,
  },
});
