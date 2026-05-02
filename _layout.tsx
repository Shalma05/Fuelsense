import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IoniconsName; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad =
    Platform.OS === "android" ? Math.max(insets.bottom, 8) : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0066cc",
        tabBarInactiveTintColor: "#aaa",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e8e8e8",
          height: 52 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          marginTop: 0,
        },
        tabBarIconStyle: { marginBottom: 2 },
      }}
      initialRouteName="index"
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarActiveTintColor: "#0066cc",
          tabBarIcon: ({ color }) => (
            <TabIcon name="flame-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarActiveTintColor: "#0066cc",
          tabBarIcon: ({ color }) => (
            <TabIcon name="map-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="travelPlanner"
        options={{
          title: "Trip Plan",
          tabBarActiveTintColor: "#e65100",
          tabBarIcon: ({ color }) => (
            <TabIcon name="navigate-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ev"
        options={{
          title: "EV",
          tabBarActiveTintColor: "#00875a",
          tabBarIcon: ({ color }) => (
            <TabIcon name="flash-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mlPredict"
        options={{
          title: "AI Predict",
          tabBarActiveTintColor: "#6200ea",
          tabBarIcon: ({ color }) => (
            <TabIcon name="analytics-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fuelLog"
        options={{
          title: "Fuel Log",
          tabBarActiveTintColor: "#1a1a2e",
          tabBarIcon: ({ color }) => (
            <TabIcon name="clipboard-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="howItWorks"
        options={{
          title: "About",
          tabBarActiveTintColor: "#1a1a2e",
          tabBarIcon: ({ color }) => (
            <TabIcon name="information-circle-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarActiveTintColor: "#555",
          tabBarIcon: ({ color }) => (
            <TabIcon name="settings-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}