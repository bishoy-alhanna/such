import React from 'react'
import { View, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import DashboardScreen       from '../screens/DashboardScreen'
import FamiliesScreen        from '../screens/FamiliesScreen'
import FamilyDetailScreen    from '../screens/FamilyDetailScreen'
import MemberDetailScreen    from '../screens/MemberDetailScreen'
import CheckInScreen         from '../screens/CheckInScreen'
import EventsScreen          from '../screens/EventsScreen'
import NotificationsScreen   from '../screens/NotificationsScreen'
import AttendanceScreen      from '../screens/AttendanceScreen'
import MoreScreen            from '../screens/MoreScreen'
import VisitsScreen          from '../screens/VisitsScreen'
import MapScreen             from '../screens/MapScreen'
import ProfileScreen         from '../screens/ProfileScreen'
import ClassesScreen         from '../screens/ClassesScreen'
import ClassDetailScreen     from '../screens/ClassDetailScreen'
import SpiritualRecordsScreen from '../screens/SpiritualRecordsScreen'
import GivingScreen          from '../screens/GivingScreen'
import GroupsScreen          from '../screens/GroupsScreen'
import ScoresScreen          from '../screens/ScoresScreen'
import VolunteerScreen          from '../screens/VolunteerScreen'
import FollowUpTasksScreen      from '../screens/FollowUpTasksScreen'
import UsersScreen              from '../screens/UsersScreen'
import ReportsScreen            from '../screens/ReportsScreen'
import ScoreCategoriesScreen    from '../screens/ScoreCategoriesScreen'
import ApprovalsScreen          from '../screens/ApprovalsScreen'
import AuditScreen              from '../screens/AuditScreen'

const Tab      = createBottomTabNavigator()
const Stack    = createNativeStackNavigator()
const FamStack = createNativeStackNavigator()
const Root     = createNativeStackNavigator()

const headerStyle = { backgroundColor: '#fff' }
const stackOpts   = { headerStyle, headerTitleAlign: 'center' as const, headerBackTitle: 'رجوع' }

// ─── Families stack ───────────────────────────────────────────────────────────
function FamiliesStack() {
  return (
    <FamStack.Navigator screenOptions={stackOpts}>
      <FamStack.Screen name="FamiliesList"  component={FamiliesScreen}     options={{ title: 'العائلات' }} />
      <FamStack.Screen name="FamilyDetail"  component={FamilyDetailScreen} options={({ route }: any) => ({ title: route.params?.name ?? 'العائلة' })} />
      <FamStack.Screen name="MemberDetail"  component={MemberDetailScreen} options={({ route }: any) => ({ title: route.params?.name ?? 'العضو' })} />
    </FamStack.Navigator>
  )
}

// ─── More stack ───────────────────────────────────────────────────────────────
function MoreStack() {
  return (
    <Stack.Navigator screenOptions={stackOpts}>
      <Stack.Screen name="MoreHub"            component={MoreScreen}             options={{ title: 'المزيد' }} />
      <Stack.Screen name="Attendance"         component={AttendanceScreen}       options={{ title: 'تسجيل الحضور' }} />
      <Stack.Screen name="VisitsTab"          component={VisitsScreen}           options={{ title: 'الزيارات' }} />
      <Stack.Screen name="MapTab"             component={MapScreen}              options={{ title: 'الخريطة' }} />
      <Stack.Screen name="NotificationsTab"   component={NotificationsScreen}    options={{ title: 'الإشعارات' }} />
      <Stack.Screen name="ClassesTab"         component={ClassesScreen}          options={{ title: 'الفصول' }} />
      <Stack.Screen name="ClassDetail"        component={ClassDetailScreen}      options={({ route }: any) => ({ title: route.params?.name ?? 'الفصل' })} />
      <Stack.Screen name="SpiritualRecords"   component={SpiritualRecordsScreen} options={{ title: 'السجلات الروحية' }} />
      <Stack.Screen name="GivingTab"          component={GivingScreen}           options={{ title: 'التبرعات' }} />
      <Stack.Screen name="GroupsTab"          component={GroupsScreen}           options={{ title: 'المجموعات' }} />
      <Stack.Screen name="ScoresTab"          component={ScoresScreen}           options={{ title: 'النقاط' }} />
      <Stack.Screen name="VolunteerTab"       component={VolunteerScreen}         options={{ title: 'المتطوعون' }} />
      <Stack.Screen name="FollowUpTasks"      component={FollowUpTasksScreen}    options={{ title: 'المهام' }} />
      <Stack.Screen name="Users"              component={UsersScreen}            options={{ title: 'المستخدمون' }} />
      <Stack.Screen name="Reports"            component={ReportsScreen}          options={{ title: 'التقارير' }} />
      <Stack.Screen name="ScoreCategories"    component={ScoreCategoriesScreen}  options={{ title: 'فئات النقاط' }} />
      <Stack.Screen name="Approvals"          component={ApprovalsScreen}        options={{ title: 'الموافقات' }} />
      <Stack.Screen name="Audit"              component={AuditScreen}            options={{ title: 'سجل المراجعة' }} />
      <Stack.Screen name="MemberDetail"       component={MemberDetailScreen}     options={({ route }: any) => ({ title: route.params?.name ?? 'العضو' })} />
    </Stack.Navigator>
  )
}

// ─── 5-tab bar ────────────────────────────────────────────────────────────────
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, [string, string]> = {
            Dashboard:  ['home',     'home-outline'],
            Families:   ['people',   'people-outline'],
            CheckInTab: ['qr-code',  'qr-code-outline'],
            EventsTab:  ['calendar', 'calendar-outline'],
            More:       ['grid',     'grid-outline'],
          }
          const [filled, outline] = icons[route.name] ?? ['ellipse', 'ellipse-outline']
          const iconName = focused ? filled : outline
          if (route.name === 'CheckInTab') {
            return (
              <View style={tabStyles.centerIcon}>
                <Ionicons name={iconName as any} size={26} color="#fff" />
              </View>
            )
          }
          return <Ionicons name={iconName as any} size={size} color={color} />
        },
        tabBarActiveTintColor:   '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle:             { paddingBottom: 4, height: 60 },
        headerStyle,
        headerTitleAlign: 'center' as const,
      })}
    >
      <Tab.Screen name="Dashboard"  component={DashboardScreen} options={{ title: 'الرئيسية' }} />
      <Tab.Screen name="Families"   component={FamiliesStack}   options={{ title: 'العائلات', headerShown: false }} />
      <Tab.Screen name="CheckInTab" component={CheckInScreen}   options={{ title: 'تسجيل', tabBarLabel: 'تسجيل', tabBarItemStyle: { marginBottom: 8 } }} />
      <Tab.Screen name="EventsTab"  component={EventsScreen}    options={{ title: 'الفعاليات' }} />
      <Tab.Screen name="More"       component={MoreStack}        options={{ title: 'المزيد', headerShown: false }} />
    </Tab.Navigator>
  )
}

// ─── Root navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Screen name="Tabs" component={Tabs} />
      <Root.Screen name="Profile"      component={ProfileScreen}      options={{ headerShown: true, ...stackOpts, title: 'الملف الشخصي' }} />
      <Root.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, ...stackOpts, title: 'الإشعارات' }} />
      <Root.Screen name="MemberDetail"  component={MemberDetailScreen}  options={({ route }: any) => ({ headerShown: true, ...stackOpts, title: route.params?.name ?? 'العضو' })} />
      <Root.Screen name="FamilyDetail"  component={FamilyDetailScreen}  options={({ route }: any) => ({ headerShown: true, ...stackOpts, title: route.params?.name ?? 'العائلة' })} />
      <Root.Screen name="ClassDetail"   component={ClassDetailScreen}   options={({ route }: any) => ({ headerShown: true, ...stackOpts, title: route.params?.name ?? 'الفصل' })} />
      <Root.Screen name="Events"        component={EventsScreen}        options={{ headerShown: true, ...stackOpts, title: 'الفعاليات' }} />
      <Root.Screen name="CheckIn"       component={CheckInScreen}       options={{ headerShown: true, ...stackOpts, title: 'تسجيل الحضور' }} />
    </Root.Navigator>
  )
}

const tabStyles = StyleSheet.create({
  centerIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#6366f1',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
})
