import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";

const genders = ["Female", "Male", "Non-binary", "Prefer not to say"];

const relationshipStatuses = [
  "Single",
  "Dating",
  "Engaged",
  "Married",
  "In a committed relationship",
  "It's complicated",
];

export default function OnboardingScreen() {
  const { user } = useUser();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");

  const [step, setStep] = useState(1);

  const handleContinue = () => {
    if (step < 5) {
      setStep(step + 1);
      return;
    }

    router.replace("/(tabs)/home");
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Between Us</Text>

          <Text style={styles.progressText}>{step} of 5</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressBackground}>
          <View
            style={[styles.progressFill, { width: `${(step / 5) * 100}%` }]}
          />
        </View>

        {/* Intro */}
        <Text style={styles.eyebrow}>LET'S GET TO KNOW YOU</Text>

        <Text style={styles.title}>About you</Text>

        <Text style={styles.subtitle}>
          These details help us make Between Us more personal to you.
        </Text>

        {/* First Name */}
        <Text style={styles.label}>What's your first name?</Text>

        <TextInput
          style={styles.input}
          placeholder="Your first name"
          placeholderTextColor="#9A938C"
          value={firstName}
          onChangeText={setFirstName}
        />

        {/* Birthday */}
        <Text style={styles.label}>When's your birthday?</Text>

        <TextInput
          style={styles.input}
          placeholder="DD / MM / YYYY"
          placeholderTextColor="#9A938C"
          value={birthday}
          onChangeText={setBirthday}
          keyboardType="numbers-and-punctuation"
        />

        {/* Gender */}
        <Text style={styles.label}>How do you identify?</Text>

        <View style={styles.options}>
          {genders.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                gender === option && styles.selectedOption,
              ]}
              onPress={() => setGender(option)}
            >
              <View
                style={[
                  styles.radio,
                  gender === option && styles.selectedRadio,
                ]}
              />

              <Text
                style={[
                  styles.optionText,
                  gender === option && styles.selectedOptionText,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Country */}
        <Text style={styles.label}>Where are you from?</Text>

        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor="#9A938C"
          value={country}
          onChangeText={setCountry}
        />

        {/* Relationship */}
        <Text style={styles.label}>What's your relationship status?</Text>

        <View style={styles.options}>
          {relationshipStatuses.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                relationshipStatus === option && styles.selectedOption,
              ]}
              onPress={() => setRelationshipStatus(option)}
            >
              <View
                style={[
                  styles.radio,
                  relationshipStatus === option && styles.selectedRadio,
                ]}
              />

              <Text
                style={[
                  styles.optionText,
                  relationshipStatus === option && styles.selectedOptionText,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {step === 5 ? "Finish" : "Continue"}
          </Text>
        </TouchableOpacity>

        {/* Back */}
        {step > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  container: {
    padding: 28,
    paddingTop: 60,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  brand: {
    fontSize: 20,
    fontWeight: "700",
    color: "#332B28",
  },

  progressText: {
    fontSize: 13,
    color: "#9A938C",
    fontWeight: "600",
  },

  progressBackground: {
    height: 6,
    backgroundColor: "#E8E1DA",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 38,
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#6B4E45",
    borderRadius: 10,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#A47767",
    marginBottom: 10,
  },

  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#2E2724",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#766D67",
    marginBottom: 30,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#453B37",
    marginBottom: 10,
    marginTop: 8,
  },

  input: {
    height: 54,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4DDD6",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#2E2724",
    marginBottom: 16,
  },

  options: {
    marginBottom: 14,
  },

  option: {
    minHeight: 54,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4DDD6",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  selectedOption: {
    borderColor: "#6B4E45",
    backgroundColor: "#F1EAE5",
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#C8BFB7",
    marginRight: 12,
  },

  selectedRadio: {
    borderColor: "#6B4E45",
    backgroundColor: "#6B4E45",
  },

  optionText: {
    flex: 1,
    fontSize: 15,
    color: "#453B37",
  },

  selectedOptionText: {
    fontWeight: "600",
    color: "#6B4E45",
  },

  button: {
    height: 56,
    backgroundColor: "#6B4E45",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  backButton: {
    alignItems: "center",
    padding: 16,
  },

  backText: {
    color: "#6B4E45",
    fontSize: 15,
    fontWeight: "600",
  },
});
