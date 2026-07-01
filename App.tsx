import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View, I18nManager } from 'react-native'

// Force RTL layout for Arabic
I18nManager.forceRTL(true)

import { AuthProvider, useAuth } from './src/context/AuthContext'
import LoginScreen  from './src/screens/LoginScreen'
import SignupScreen from './src/screens/SignupScreen'
import AppNavigator from './src/navigation/AppNavigator'

const RootStack = createNativeStackNavigator()

function Root() {
  const { user, loading } = useAuth()

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  )

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="App" component={AppNavigator} />
        ) : (
          <>
            <RootStack.Screen name="Login"  component={LoginScreen}  />
            <RootStack.Screen name="Signup" component={SignupScreen} options={{ headerShown: true, headerStyle: { backgroundColor: '#f8fafc' }, title: '', headerBackTitle: 'رجوع' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  )
}
