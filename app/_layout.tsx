import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { db } from "../db/client";
import migrations from "../drizzle/migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-red-500">Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-loading" options={{ gestureEnabled: false }} />
        <Stack.Screen name="add-success" />
        <Stack.Screen name="add-disambiguate" />
        <Stack.Screen name="library" />
        <Stack.Screen name="card-detail" />
        <Stack.Screen name="review" options={{ gestureEnabled: false }} />
        <Stack.Screen name="review-complete" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
