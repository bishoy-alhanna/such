import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const { login }   = useAuth()
  const navigation  = useNavigation<any>()
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const handleLogin = async () => {
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? ''
      if (msg.toLowerCase().includes('pending')) {
        setError('حسابك قيد المراجعة. يرجى انتظار موافقة المشرف.')
      } else if (msg.toLowerCase().includes('disabled')) {
        setError('هذا الحساب موقوف. تواصل مع المشرف.')
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.appName}>رعاية</Text>
          <Text style={s.appSub}>ShepherdCare</Text>
          <Text style={s.tagline}>نظام الرعاية الرعوية</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>اسم المستخدم</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#9ca3af"
            textAlign="right"
          />

          <Text style={s.label}>كلمة المرور</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            placeholderTextColor="#9ca3af"
            textAlign="right"
          />

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>تسجيل الدخول</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.signupLink} onPress={() => navigation.navigate('Signup')}>
          <Text style={s.signupText}>ليس لديك حساب؟ <Text style={s.signupHighlight}>إنشاء حساب</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:            { flex: 1, backgroundColor: '#f8fafc' },
  container:       { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:          { alignItems: 'center', marginBottom: 40 },
  appName:         { fontSize: 52, fontWeight: '900', color: '#6366f1', letterSpacing: 2 },
  appSub:          { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 4 },
  tagline:         { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  label:           { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, textAlign: 'right' },
  input:           { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', marginBottom: 16, backgroundColor: '#f9fafb' },
  errorBox:        { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText:       { color: '#dc2626', fontSize: 13, textAlign: 'right' },
  btn:             { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  signupLink:      { marginTop: 24, alignItems: 'center' },
  signupText:      { fontSize: 14, color: '#6b7280' },
  signupHighlight: { color: '#6366f1', fontWeight: '600' },
})
