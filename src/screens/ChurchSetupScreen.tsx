import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as SecureStore from 'expo-secure-store'
import { setChurchBaseUrl } from '../services/api'

const BASE_DOMAIN = 'sgch.al-hanna.com'

function normalizeUrl(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/\/+$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  // bare slug like "stmark"
  if (!trimmed.includes('.')) return `https://${trimmed}.${BASE_DOMAIN}`
  // full domain like "stmark.sgch.al-hanna.com"
  return `https://${trimmed}`
}

interface Props { onSetup: () => void }

export default function ChurchSetupScreen({ onSetup }: Props) {
  const [input, setInput]       = useState('')
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const scanned = useRef(false)

  const handleContinue = async (rawUrl?: string) => {
    const raw = rawUrl ?? input
    if (!raw.trim()) { Alert.alert('خطأ', 'يرجى إدخال رابط الكنيسة'); return }
    setLoading(true)
    try {
      const url = normalizeUrl(raw)
      // Validate by pinging the public health endpoint
      const res = await fetch(`${url}/api/health`, { method: 'GET' })
      if (!res.ok && res.status !== 404) throw new Error('not_found')
      await SecureStore.setItemAsync('church_base_url', url)
      setChurchBaseUrl(url)
      onSetup()
    } catch {
      Alert.alert('تعذّر الاتصال', 'تعذّر العثور على الكنيسة. تحقق من الرابط وحاول مجدداً.')
    } finally {
      setLoading(false)
    }
  }

  const handleQR = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission()
      if (!granted) { Alert.alert('الإذن مطلوب', 'يحتاج التطبيق إذن الكاميرا لمسح QR'); return }
    }
    scanned.current = false
    setScanning(true)
  }

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned.current) return
    scanned.current = true
    setScanning(false)
    handleContinue(data)
  }

  if (scanning) {
    return (
      <View style={styles.scannerWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>وجّه الكاميرا نحو رمز QR الخاص بالكنيسة</Text>
        </View>
        <TouchableOpacity style={styles.cancelScan} onPress={() => setScanning(false)}>
          <Text style={styles.cancelScanText}>إلغاء</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>✝</Text>
        <Text style={styles.title}>ShepherdCare</Text>
        <Text style={styles.subtitle}>رعاية</Text>
        <Text style={styles.label}>أدخل رابط كنيستك أو امسح رمز QR</Text>

        <TextInput
          style={styles.input}
          placeholder="مثال: stmark  أو  stmark.sgch.al-hanna.com"
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={() => handleContinue()}
        />

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={() => handleContinue()}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnTextPrimary}>متابعة</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>أو</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleQR}>
          <Text style={styles.btnTextSecondary}>📷  مسح رمز QR</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0d1a4e', justifyContent: 'center', padding: 24 },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center' },
  logo:         { fontSize: 40, color: '#4f46e5', marginBottom: 8 },
  title:        { fontSize: 22, fontWeight: '800', color: '#1e1b4b' },
  subtitle:     { fontSize: 14, color: '#6366f1', marginBottom: 24 },
  label:        { fontSize: 14, color: '#374151', marginBottom: 12, textAlign: 'center' },
  input:        {
    width: '100%', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#111827', marginBottom: 14,
    textAlign: 'left', writingDirection: 'ltr',
  },
  btn:          { width: '100%', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  btnPrimary:   { backgroundColor: '#4f46e5' },
  btnSecondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  btnDisabled:  { opacity: 0.6 },
  btnTextPrimary:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextSecondary: { color: '#374151', fontWeight: '600', fontSize: 15 },
  divider:      { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 8 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText:  { marginHorizontal: 10, color: '#9ca3af', fontSize: 13 },

  // Scanner
  scannerWrap:  { flex: 1, backgroundColor: '#000' },
  scanOverlay:  { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrame:    {
    width: 240, height: 240, borderWidth: 3, borderColor: '#6366f1',
    borderRadius: 16, backgroundColor: 'transparent',
  },
  scanHint:     { color: '#fff', marginTop: 24, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  cancelScan:   {
    position: 'absolute', bottom: 48, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 30,
  },
  cancelScanText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
