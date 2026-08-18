import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* TOP */}
        <View style={styles.top}>
          <Text style={styles.brand}>BETWEEN US</Text>

          <View style={styles.logoCircle}>
            <Text style={styles.logo}>♡</Text>
          </View>
        </View>

        {/* MAIN */}
        <View style={styles.content}>
          <Text style={styles.eyebrow}>FOR THE PEOPLE WHO MATTER</Text>

          <Text style={styles.title}>
            Relationships
            {"\n"}
            worth being
            {"\n"}
            <Text style={styles.titleAccent}>intentional about.</Text>
          </Text>

          <Text style={styles.description}>
            Between Us helps you understand the people you care about, remember
            what matters to them, and build a stronger connection together.
          </Text>
        </View>

        {/* BOTTOM */}
        <View style={styles.bottom}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={() => router.push("/sign-up")}
          >
            <Text style={styles.primaryText}>Get Started</Text>

            <Text style={styles.primaryArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryButton}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={styles.secondaryText}>I already have an account</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            A private space for meaningful relationships.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },

  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#6B4E45",
  },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    fontSize: 25,
    color: "#6B4E45",
    marginTop: -2,
  },

  content: {
    marginTop: 50,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: "#9A918A",
    marginBottom: 18,
  },

  title: {
    fontSize: 42,
    lineHeight: 47,
    fontWeight: "700",
    color: "#302825",
    letterSpacing: -1,
  },

  titleAccent: {
    color: "#6B4E45",
  },

  description: {
    marginTop: 22,
    fontSize: 15,
    lineHeight: 23,
    color: "#817771",
    maxWidth: 340,
  },

  bottom: {
    marginTop: 40,
  },

  primaryButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: "#6B4E45",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  primaryArrow: {
    color: "#FFFFFF",
    fontSize: 22,
  },

  secondaryButton: {
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  secondaryText: {
    color: "#6B4E45",
    fontSize: 15,
    fontWeight: "600",
  },

  footerText: {
    textAlign: "center",
    color: "#AAA09A",
    fontSize: 11,
    marginTop: 16,
  },
});
