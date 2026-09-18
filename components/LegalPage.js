import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { GlassBackground } from "./Glass";

/*
 * ==========================================
 * LEGAL PAGE
 * ==========================================
 *
 * Shared layout for Terms and Privacy. Sections are
 * plain objects so the wording stays easy to edit
 * without touching any markup.
 */

export default function LegalPage({ title, updated, intro, sections }) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.updated}>Last updated {updated}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>{intro}</Text>

          {sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>

              {section.paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}

          <Text style={styles.footer}>
            Questions about any of this? Email ellaukata@gmail.com.
          </Text>
        </ScrollView>
      </GlassBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF8F5",
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 6,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },

  backArrow: {
    fontFamily: "Nunito_400Regular",
    fontSize: 24,
    color: "#D9456B",
  },

  title: {
    fontFamily: "Fraunces_700Bold",
    marginTop: 4,
    fontSize: 28,
    fontWeight: "800",
    color: "#2E2430",
  },

  updated: {
    fontFamily: "Nunito_400Regular",
    marginTop: 6,
    fontSize: 12,
    color: "#9C8F97",
  },

  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },

  intro: {
    fontFamily: "Nunito_400Regular",
    marginTop: 16,
    fontSize: 15,
    lineHeight: 23,
    color: "#5E544F",
  },

  section: {
    marginTop: 26,
  },

  heading: {
    fontFamily: "Nunito_700Bold",
    fontSize: 17,
    fontWeight: "700",
    color: "#2E2430",
    marginBottom: 8,
  },

  paragraph: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: "#5E544F",
    marginBottom: 10,
  },

  footer: {
    fontFamily: "Nunito_400Regular",
    marginTop: 34,
    fontSize: 13,
    lineHeight: 20,
    color: "#6B5F68",
  },
});
