import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

const API_URL = "https://between-us-api.between-us.workers.dev";

const relationshipTypes = ["Friendship", "Dating", "Engaged", "Married"];

export default function FindPersonScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const [selectedPerson, setSelectedPerson] = useState(null);
  const [relationshipType, setRelationshipType] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * ==========================================
   * SEARCH
   * ==========================================
   */

  const searchPeople = async () => {
    const cleanQuery = query.trim();

    setError("");
    setSuccess("");

    if (!cleanQuery) {
      setResults([]);
      return;
    }

    if (!isLoaded || !isSignedIn || !userId) {
      setError("Your account is not ready yet.");
      return;
    }

    try {
      Keyboard.dismiss();

      setSearching(true);

      const response = await fetch(
        `${API_URL}/search?query=${encodeURIComponent(
          cleanQuery,
        )}&clerk_id=${encodeURIComponent(userId)}`,
      );

      const data = await response.json();

      console.log("SEARCH RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to search.");
      }

      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("SEARCH ERROR:", err);

      setResults([]);

      setError(err?.message || "Something went wrong while searching.");
    } finally {
      setSearching(false);
    }
  };

  /*
   * ==========================================
   * SELECT PERSON
   * ==========================================
   */

  const selectPerson = (person) => {
    setSelectedPerson(person);
    setRelationshipType("");
    setError("");
    setSuccess("");
  };

  /*
   * ==========================================
   * SEND REQUEST
   * ==========================================
   */

  const sendRequest = async () => {
    if (!selectedPerson) return;

    if (!relationshipType) {
      setError("Choose your relationship with this person.");
      return;
    }

    if (!userId) {
      setError("Your account is not ready yet.");
      return;
    }

    try {
      setSendingId(selectedPerson.clerk_id);
      setError("");
      setSuccess("");

      const response = await fetch(`${API_URL}/connections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_clerk_id: userId,
          to_clerk_id: selectedPerson.clerk_id,
          relationship_type: relationshipType.toLocaleLowerCase(),
        }),
      });

      const data = await response.json();

      console.log("CONNECTION RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to send connection request.");
      }

      /*
       * Remove the person from search results.
       */

      setResults((prev) =>
        prev.filter((person) => person.clerk_id !== selectedPerson.clerk_id),
      );

      setSuccess(`Connection request sent to ${selectedPerson.first_name}.`);

      setSelectedPerson(null);
      setRelationshipType("");
    } catch (err) {
      console.log("SEND CONNECTION ERROR:", err);

      setError(
        err?.message || "Something went wrong while sending the request.",
      );
    } finally {
      setSendingId(null);
    }
  };

  /*
   * ==========================================
   * CLEAR SEARCH
   * ==========================================
   */

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setError("");
    setSuccess("");
  };

  /*
   * ==========================================
   * AUTH LOADING
   * ==========================================
   */

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="small" color="#6B4E45" />

          <Text style={styles.loadingText}>Preparing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ==========================================
   * PERSON CARD
   * ==========================================
   */

  const renderPerson = ({ item }) => {
    const isSending = sendingId === item.clerk_id;

    return (
      <TouchableOpacity
        style={styles.personCard}
        activeOpacity={0.8}
        onPress={() => selectPerson(item)}
        disabled={isSending}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.first_name?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>

        <View style={styles.personInfo}>
          <Text style={styles.personName}>{item.first_name}</Text>

          <Text style={styles.personEmail}>{item.email}</Text>

          {item.country ? (
            <Text style={styles.personCountry}>{item.country}</Text>
          ) : null}
        </View>

        <Text style={styles.personArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  /*
   * ==========================================
   * SCREEN
   * ==========================================
   */

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>BETWEEN US</Text>

            <Text style={styles.title}>Find your person.</Text>

            <Text style={styles.subtitle}>
              Search for someone you want to build a connection with.
            </Text>
          </View>
        </View>

        {/* SEARCH */}

        <View style={styles.searchContainer}>
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setError("");
              setSuccess("");
            }}
            placeholder="Search by name or email"
            placeholderTextColor="#AAA09A"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={searchPeople}
          />

          {query.length > 0 ? (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Text style={styles.clearText}>×</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.searchButton}
            onPress={searchPeople}
            disabled={searching}
            activeOpacity={0.8}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ERROR */}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* SUCCESS */}

        {success ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {/* RESULTS */}

        <FlatList
          data={results}
          keyExtractor={(item) => item.clerk_id}
          renderItem={renderPerson}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.results,
            results.length === 0 && styles.emptyResults,
          ]}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsTitle}>People</Text>
            ) : null
          }
          ListEmptyComponent={
            !searching ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Text style={styles.emptyHeart}>♡</Text>
                </View>

                <Text style={styles.emptyTitle}>
                  {query ? "No one found" : "Start with a name"}
                </Text>

                <Text style={styles.emptyText}>
                  {query
                    ? "Try searching with a different name or email address."
                    : "Find the person you want to connect with and start building something meaningful together."}
                </Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* RELATIONSHIP MODAL */}

      {selectedPerson ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setSelectedPerson(null);
                setRelationshipType("");
                setError("");
              }}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>

            <View style={styles.modalAvatar}>
              <Text style={styles.modalAvatarText}>
                {selectedPerson.first_name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>

            <Text style={styles.modalTitle}>
              Connect with {selectedPerson.first_name}?
            </Text>

            <Text style={styles.modalSubtitle}>
              Tell us what this relationship means to you.
            </Text>

            <Text style={styles.relationshipLabel}>Relationship</Text>

            <View style={styles.relationships}>
              {relationshipTypes.map((type) => {
                const selected = relationshipType === type;

                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.relationshipButton,
                      selected && styles.relationshipSelected,
                    ]}
                    onPress={() => setRelationshipType(type)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.relationshipText,
                        selected && styles.relationshipSelectedText,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.connectButton,
                (!relationshipType || sendingId) && styles.disabledButton,
              ]}
              disabled={!relationshipType || !!sendingId}
              onPress={sendRequest}
              activeOpacity={0.85}
            >
              {sendingId ? (
                <View style={styles.connectLoading}>
                  <ActivityIndicator size="small" color="#FFFFFF" />

                  <Text style={styles.connectText}>Sending...</Text>
                </View>
              ) : (
                <Text style={styles.connectText}>Send Connection Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/*
 * ==========================================
 * STYLES
 * ==========================================
 */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },

  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#817771",
  },

  /*
   * HEADER
   */

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  backArrow: {
    fontSize: 21,
    color: "#6B4E45",
    marginTop: -2,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: "#9A918A",
    marginBottom: 6,
  },

  title: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "700",
    color: "#302825",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
    maxWidth: 310,
  },

  /*
   * SEARCH
   */

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
    height: 54,
  },

  searchInput: {
    flex: 1,
    height: 54,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E1DC",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingRight: 42,
    fontSize: 14,
    color: "#302825",
  },

  clearButton: {
    position: "absolute",
    right: 82,
    width: 30,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  clearText: {
    fontSize: 25,
    color: "#AAA09A",
    lineHeight: 28,
  },

  searchButton: {
    height: 54,
    paddingHorizontal: 17,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    minWidth: 78,
  },

  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /*
   * MESSAGES
   */

  errorBox: {
    backgroundColor: "#F3E3DF",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: 12,
  },

  errorText: {
    color: "#8A4A3D",
    fontSize: 13,
    lineHeight: 18,
  },

  successBox: {
    backgroundColor: "#E6EEE7",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: 12,
  },

  successText: {
    color: "#4F6B54",
    fontSize: 13,
    lineHeight: 18,
  },

  /*
   * RESULTS
   */

  results: {
    paddingTop: 24,
    paddingBottom: 30,
  },

  emptyResults: {
    flexGrow: 1,
    justifyContent: "center",
  },

  resultsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B625C",
    marginBottom: 12,
  },

  personCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDE7E2",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B4E45",
  },

  personInfo: {
    flex: 1,
    marginLeft: 13,
  },

  personName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#302825",
  },

  personEmail: {
    marginTop: 3,
    fontSize: 12,
    color: "#817771",
  },

  personCountry: {
    marginTop: 3,
    fontSize: 11,
    color: "#AAA09A",
  },

  personArrow: {
    fontSize: 26,
    color: "#9A918A",
    marginLeft: 8,
  },

  /*
   * EMPTY
   */

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 25,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },

  emptyHeart: {
    fontSize: 34,
    color: "#6B4E45",
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#302825",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#817771",
    textAlign: "center",
  },

  /*
   * MODAL
   */

  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(48,40,37,0.35)",
    justifyContent: "flex-end",
  },

  modal: {
    backgroundColor: "#F8F5F0",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },

  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D7CEC8",
    alignSelf: "center",
    marginBottom: 8,
  },

  modalClose: {
    position: "absolute",
    right: 20,
    top: 17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },

  modalCloseText: {
    fontSize: 23,
    color: "#6B4E45",
    lineHeight: 25,
  },

  modalAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 12,
  },

  modalAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#6B4E45",
  },

  modalTitle: {
    marginTop: 15,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    color: "#302825",
    textAlign: "center",
  },

  modalSubtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#817771",
    textAlign: "center",
  },

  relationshipLabel: {
    marginTop: 23,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#5F554F",
  },

  relationships: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  relationshipButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E1DC",
  },

  relationshipSelected: {
    backgroundColor: "#6B4E45",
    borderColor: "#6B4E45",
  },

  relationshipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B625C",
  },

  relationshipSelectedText: {
    color: "#FFFFFF",
  },

  connectButton: {
    height: 55,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  disabledButton: {
    opacity: 0.45,
  },

  connectLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  connectText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
