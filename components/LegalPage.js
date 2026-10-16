import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { T } from "../lib/theme";
import { Card, GlassButton, LargeTitle, NavBar, Screen, SubTitle } from "./ui";

/*
 * ==========================================
 * LEGAL PAGE
 * ==========================================
 *
 * Shared layout for Terms and Privacy: a large title,
 * when it last changed, then each section as a card.
 * Sections are plain objects so the wording stays easy
 * to edit without touching any markup.
 */

export default function LegalPage({ title, updated, intro, sections }) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <Screen>
      <NavBar
        left={<GlassButton icon="back" label="Back" onPress={goBack} />}
      />

      <LargeTitle>{title}</LargeTitle>

      <SubTitle>Last updated {updated}</SubTitle>

      <Text style={styles.intro}>{intro}</Text>

      {sections.map((section) => (
        <Card key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>

          {section.paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </Card>
      ))}

      <View style={styles.footerWrap}>
        <Text style={styles.footer}>
          Questions about any of this? Email ellaukata@gmail.com.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 17,
    lineHeight: 24,
    color: T.label,
    paddingHorizontal: 16,
  },

  section: {
    gap: 8,
  },

  heading: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: T.label,
  },

  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: T.label2,
  },

  footerWrap: {
    paddingHorizontal: 16,
  },

  footer: {
    fontSize: 13,
    lineHeight: 18,
    color: T.label2,
    textAlign: "center",
  },
});
