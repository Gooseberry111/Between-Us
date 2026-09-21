import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, FadeIn, GlassBackground } from "../components/Glass";
import { PASTELS, Squish } from "../components/Playful";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { apiFetch } from "../lib/api";

const relationshipTypes = ["Friendship", "Dating", "Engaged", "Married"];

/* The API ignores anything shorter, to stop a single
 * letter listing everybody. */
const MIN_QUERY_LENGTH = 2;

/*
 * Everyone gets a colour, picked from their name, so the
 * list reads as people rather than rows. The same person is
 * always the same colour.
 */
const AVATAR_TONES = ["blush", "sky", "sage", "butter", "lilac", "clay"];

function toneFor(name) {
  const text = String(name || "?");
  let sum = 0;

  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);

  return PASTELS[AVATAR_TONES[sum % AVATAR_TONES.length]];
}

const SEARCH_TIPS = [
  {
    icon: "search-outline",
    tone: PASTELS.sky,
    title: "Their first name is enough",
    text: "Type a few letters and matches appear as you go.",
  },
  {
    icon: "mail-outline",
    tone: PASTELS.lilac,
    title: "Or use their email",
    text: "An exact address finds one person and no one else.",
  },
  {
    icon: "heart-outline",
    tone: PASTELS.blush,
    title: "Then send a request",
    text: "Nothing is shared until they accept it.",
  },
];

function SearchEmptyState({ query, searching, hasRequests }) {
  const trimmed = query.trim();

  if (searching) {
    return (
      <View style={styles.searchingState}>
        <ActivityIndicator size="small" color="#D9456B" />

        <Text style={styles.searchingText}>Looking...</Text>
      </View>
    );
  }

  if (trimmed.length === 1) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Keep going</Text>

        <Text style={styles.emptyText}>
          One more letter and the matches start showing up.
        </Text>
      </View>
    );
  }

  if (trimmed.length >= MIN_QUERY_LENGTH) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="person-outline" size={26} color="#D9456B" />
        </View>

        <Text style={styles.emptyTitle}>No one called "{trimmed}"</Text>

        <Text style={styles.emptyText}>
          Check the spelling, try their email address, or ask them to create
          their account first. People already connected to someone else don't
          show up here.
        </Text>
      </View>
    );
  }

  /* Requests above already fill the page and say more
     than any explainer would. */
  if (hasRequests) return null;

  /* Nothing typed yet: say what this page is for. */
  return (
    <FadeIn delay={60}>
      <View style={styles.tips}>
        <Text style={styles.tipsHeading}>How this works</Text>

        {SEARCH_TIPS.map((tip, index) => (
          <View
            key={tip.title}
            style={[styles.tipRow, index === 0 && styles.tipRowFirst]}
          >
            <View style={[styles.tipIcon, { backgroundColor: tip.tone.bg }]}>
              <Ionicons name={tip.icon} size={17} color={tip.tone.ink} />
            </View>

            <View style={styles.tipTextWrap}>
              <Text style={styles.tipTitle}>{tip.title}</Text>

              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </FadeIn>
  );
}

export default function FindPersonScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(false);

  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState(null);

  const [selectedPerson, setSelectedPerson] = useState(null);
  const [relationshipType, setRelationshipType] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * ==========================================
   * LOAD CONNECTION REQUESTS
   * ==========================================
   */

  const loadRequests = async () => {
    if (!isLoaded || !isSignedIn || !userId) {
      setLoadingRequests(false);
      return;
    }

    try {
      setLoadingRequests(true);

      const response = await apiFetch(`/users/${userId}/connection-requests`);

      const data = await response.json();

      console.log("CONNECTION REQUESTS:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load connection requests.");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("REQUESTS ERROR:", err);

      setRequests([]);
      setError(err?.message || "Unable to load connection requests.");
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [isLoaded, isSignedIn, userId]);

  /*
   * ==========================================
   * SEARCH
   * ==========================================
   */

  /*
   * Results arrive as you type. Each keystroke cancels the
   * one before it, and a counter makes sure a slow early
   * reply can't overwrite the results for what you have
   * typed since.
   */
  const searchToken = useRef(0);

  const runSearch = useCallback(
    async (rawQuery) => {
      const cleanQuery = rawQuery.trim();
      const token = ++searchToken.current;

      if (cleanQuery.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setSearching(false);
        return;
      }

      if (!isLoaded || !isSignedIn || !userId) {
        setError("Your account is not ready yet.");
        return;
      }

      try {
        setSearching(true);

        const response = await apiFetch(
          `/search?query=${encodeURIComponent(
            cleanQuery,
          )}&clerk_id=${encodeURIComponent(userId)}`,
        );

        const data = await response.json();

        if (token !== searchToken.current) return;

        if (!response.ok) {
          throw new Error(data?.error || "Unable to search.");
        }

        setResults(Array.isArray(data) ? data : []);
        setError("");
      } catch (err) {
        console.log("SEARCH ERROR:", err);

        if (token !== searchToken.current) return;

        setResults([]);
        setError(err?.message || "Something went wrong while searching.");
      } finally {
        if (token === searchToken.current) setSearching(false);
      }
    },
    [isLoaded, isSignedIn, userId],
  );

  /* Wait for a pause in typing so one search runs, not eight. */
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      searchToken.current += 1;
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    const timer = setTimeout(() => runSearch(trimmed), 280);

    return () => clearTimeout(timer);
  }, [query, runSearch]);

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

  const viewRequest = (request) => {
    console.log("VIEW REQUEST CLICKED:", request);

    setSelectedRequest(request);
    setError("");
    setSuccess("");
  };
  const acceptRequest = async () => {
    if (!selectedRequest || !userId) return;

    try {
      setProcessingRequest(true);
      setError("");

      const response = await apiFetch(
        `/connections/${selectedRequest.id}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clerk_id: userId,
          }),
        },
      );

      const data = await response.json();

      console.log("ACCEPT REQUEST RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to accept request.");
      }

      setSuccess("Connection accepted.");

      setSelectedRequest(null);

      await loadRequests();
    } catch (err) {
      console.log("ACCEPT REQUEST ERROR:", err);

      setError(err?.message || "Unable to accept connection request.");
    } finally {
      setProcessingRequest(false);
    }
  };
  const rejectRequest = async () => {
    if (!selectedRequest || !userId) return;

    try {
      setProcessingRequest(true);
      setError("");

      const response = await apiFetch(
        `/connections/${selectedRequest.id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clerk_id: userId,
          }),
        },
      );

      const data = await response.json();

      console.log("REJECT REQUEST RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to reject request.");
      }

      setSuccess("Connection request rejected.");

      setSelectedRequest(null);

      await loadRequests();
    } catch (err) {
      console.log("REJECT REQUEST ERROR:", err);

      setError(err?.message || "Unable to reject connection request.");
    } finally {
      setProcessingRequest(false);
    }
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

      const response = await apiFetch(`/connections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_clerk_id: userId,
          to_clerk_id: selectedPerson.clerk_id,
          relationship_type: relationshipType.toLowerCase(),
        }),
      });

      const data = await response.json();

      console.log("CONNECTION RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to send connection request.");
      }

      /*
       * They stay in the list, now marked. Removing them made
       * it look as though the request had failed, or as though
       * the person had vanished.
       */
      setResults((prev) =>
        prev.map((person) =>
          person.clerk_id === selectedPerson.clerk_id
            ? { ...person, request_state: "sent" }
            : person,
        ),
      );

      setSuccess(`Connection request sent to ${selectedPerson.first_name}.`);

      setSelectedPerson(null);
      setRelationshipType("");

      await loadRequests();
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
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="small" color="#D9456B" />

          <Text style={styles.loadingText}>Preparing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ==========================================
   * REQUEST CARD
   * ==========================================
   */

  const renderRequest = ({ item }) => {
    const name = item.requester_first_name || "Someone";
    const tone = toneFor(name);

    return (
      <Squish onPress={() => viewRequest(item)} style={styles.requestCard}>
        <View style={styles.requestTop}>
          <View style={[styles.requestAvatar, { backgroundColor: tone.bg }]}>
            <Text style={[styles.requestAvatarText, { color: tone.ink }]}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>{name}</Text>

            <Text style={styles.requestText}>wants to connect with you</Text>
          </View>

          {item.relationship_type ? (
            <View style={styles.relationshipPill}>
              <Text style={styles.relationshipPillText}>
                {item.relationship_type.charAt(0).toUpperCase() +
                  item.relationship_type.slice(1)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.requestActionsRow}>
          <View style={styles.requestViewButton}>
            <Text style={styles.requestViewButtonText}>See their request</Text>

            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </View>
        </View>
      </Squish>
    );
  };

  /*
   * ==========================================
   * PERSON CARD
   * ==========================================
   */

  const renderPerson = ({ item }) => {
    const isSending = sendingId === item.clerk_id;
    const sent = item.request_state === "sent";
    const received = item.request_state === "received";

    /* Someone who has asked you can be answered right here. */
    const theirRequest = received
      ? requests.find((request) => request.requester_clerk_id === item.clerk_id)
      : null;

    const onPress = () => {
      if (sent) return;

      if (theirRequest) {
        viewRequest(theirRequest);
        return;
      }

      selectPerson(item);
    };

    const tone = toneFor(item.first_name);

    return (
      <Squish
        style={[styles.personCard, sent && styles.personCardMuted]}
        onPress={onPress}
        disabled={isSending || sent}
      >
        <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
          <Text style={[styles.avatarText, { color: tone.ink }]}>
            {item.first_name?.charAt(0)?.toUpperCase() || "?"}
          </Text>
        </View>

        <View style={styles.personInfo}>
          <Text style={styles.personName}>{item.first_name}</Text>

          <View style={styles.personMetaRow}>
            {item.country ? (
              <>
                <Ionicons name="location-outline" size={11} color="#B9A7B1" />

                <Text style={styles.personCountry}>{item.country}</Text>
              </>
            ) : null}

            {item.relationship_status ? (
              <Text style={styles.personCountry}>
                {item.country ? " · " : ""}
                {item.relationship_status}
              </Text>
            ) : null}
          </View>
        </View>

        {isSending ? (
          <ActivityIndicator size="small" color="#D9456B" />
        ) : sent ? (
          <View style={styles.statePill}>
            <Ionicons name="checkmark" size={12} color="#7C7280" />
            <Text style={styles.statePillText}>Requested</Text>
          </View>
        ) : received ? (
          <View style={[styles.statePill, styles.statePillActive]}>
            <Text style={[styles.statePillText, styles.statePillTextActive]}>
              Asked you
            </Text>
          </View>
        ) : (
          <View style={styles.connectButton}>
            <Text style={styles.connectButtonText}>Connect</Text>
          </View>
        )}
      </Squish>
    );
  };

  /*
   * ==========================================
   * SCREEN
   * ==========================================
   */

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <GlassBackground>
        <View style={styles.container}>
          {/* HEADER */}

          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color="#D9456B" />
            </TouchableOpacity>

            <Text style={styles.title}>Find your person</Text>
          </View>

          {/* SEARCH */}

          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={18}
              color="#9A8F88"
              style={styles.searchIcon}
            />

            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setError("");
                setSuccess("");
              }}
              placeholder="Start typing a name, or paste their email"
              placeholderTextColor="#B9A7B1"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />

            {searching ? (
              <ActivityIndicator
                size="small"
                color="#D9456B"
                style={styles.searchSpinner}
              />
            ) : null}

            {query.length > 0 && !searching ? (
              <TouchableOpacity
                onPress={clearSearch}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#B9AFA8" />
              </TouchableOpacity>
            ) : null}
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

          {/* CONNECTION REQUESTS -- under the search field, where
              someone looking for a person will actually see them. */}

          {!loadingRequests && requests.length > 0 ? (
            <View style={styles.requestsSection}>
              <Text style={styles.requestsTitle}>
                {requests.length === 1
                  ? "1 PERSON WANTS TO CONNECT"
                  : `${requests.length} PEOPLE WANT TO CONNECT`}
              </Text>

              <FlatList
                data={requests}
                keyExtractor={(item) => item.id}
                renderItem={renderRequest}
                scrollEnabled={false}
              />
            </View>
          ) : null}

          {loadingRequests ? (
            <View style={styles.requestLoading}>
              <ActivityIndicator size="small" color="#D9456B" />

              <Text style={styles.requestLoadingText}>
                Checking for requests...
              </Text>
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
              results.length === 0 && styles.emptyResultsTop,
            ]}
            ListHeaderComponent={
              results.length > 0 ? (
                <Text style={styles.resultsTitle}>People</Text>
              ) : null
            }
            ListEmptyComponent={
              <SearchEmptyState
                query={query}
                searching={searching}
                hasRequests={requests.length > 0}
              />
            }
          />
        </View>
      </GlassBackground>

      {/* RELATIONSHIP MODAL */}
      {/* CONNECTION REQUEST DETAILS */}

      {selectedRequest ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedRequest(null)}
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>

            <View style={styles.modalAvatar}>
              <Text style={styles.modalAvatarText}>
                {selectedRequest.requester_first_name
                  ?.trim()
                  ?.charAt(0)
                  ?.toUpperCase() || "?"}
              </Text>
            </View>

            <Text style={styles.modalTitle}>
              {selectedRequest.requester_first_name?.trim() || "Someone"}
            </Text>

            <Text style={styles.modalSubtitle}>Wants to connect with you</Text>

            <View style={styles.requestDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Relationship</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.relationship_type
                    ? selectedRequest.relationship_type
                        .charAt(0)
                        .toUpperCase() +
                      selectedRequest.relationship_type.slice(1)
                    : "Not specified"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Country</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.requester_country?.trim() || "Not specified"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Gender</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.requester_gender || "Not specified"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Relationship status</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.requester_relationship_status ||
                    "Not specified"}
                </Text>
              </View>
            </View>

            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[
                  styles.rejectButton,
                  processingRequest && styles.disabledButton,
                ]}
                onPress={rejectRequest}
                disabled={processingRequest}
              >
                {processingRequest ? (
                  <ActivityIndicator size="small" color="#D9456B" />
                ) : (
                  <Text style={styles.rejectButtonText}>Reject</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  processingRequest && styles.disabledButton,
                ]}
                onPress={acceptRequest}
                disabled={processingRequest}
              >
                {processingRequest ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
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
    backgroundColor: "#FFF8F5",
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
    color: "#6B5F68",
  },

  /*
   * HEADER
   */

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F9E3EA",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2E2430",
    letterSpacing: -0.4,
  },

  /*
   * REQUESTS
   */

  requestsSection: {
    marginTop: 22,
  },

  requestsTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#D9456B",
    marginBottom: 10,
  },

  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F9E3EA",
    shadowColor: "#D9456B",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  requestTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  relationshipPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F9E3EA",
  },

  relationshipPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#D9456B",
  },

  requestActionsRow: {
    marginTop: 14,
  },

  requestAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },

  requestAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#D9456B",
  },

  requestInfo: {
    flex: 1,
    marginLeft: 13,
  },

  requestName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E2430",
  },

  requestText: {
    marginTop: 3,
    fontSize: 12,
    color: "#6B5F68",
  },

  requestViewButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#F1E9E5",
  },

  requestViewButtonText: {
    color: "#D9456B",
    fontSize: 12,
    fontWeight: "700",
  },

  requestLoading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },

  requestLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#6B5F68",
  },

  /*
   * SEARCH
   */

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    shadowColor: "#D9456B",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    height: 56,
    fontSize: 15,
    color: "#2E2430",
  },

  searchSpinner: {
    marginLeft: 8,
  },

  clearButton: {
    marginLeft: 8,
    padding: 4,
  },

  searchingState: {
    alignItems: "center",
    paddingTop: 30,
  },

  searchingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#6B5F68",
  },

  tips: {
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FAECF1",
  },

  tipsHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2E2430",
    marginBottom: 4,
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 14,
  },

  tipRowFirst: {
    paddingTop: 12,
  },

  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  tipTextWrap: {
    flex: 1,
  },

  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2E2430",
  },

  tipText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5F68",
  },

  /*
   * MESSAGES
   */

  errorBox: {
    backgroundColor: "#F9E3EA",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginTop: 12,
  },

  errorText: {
    color: "#C2405F",
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
    paddingTop: 18,
    paddingBottom: 30,
  },

  emptyResultsTop: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },

  personCardMuted: {
    opacity: 0.72,
  },

  statePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2EDF0",
  },

  statePillActive: {
    backgroundColor: "#D9456B",
  },

  statePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A6A62",
  },

  statePillTextActive: {
    color: "#FFFFFF",
  },

  resultsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B5F68",
    marginBottom: 12,
  },

  personCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FAECF1",
    shadowColor: "#D9456B",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  personMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },

  connectButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#D9456B",
  },

  connectButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 19,
    fontWeight: "800",
  },

  personInfo: {
    flex: 1,
    marginLeft: 13,
  },

  personName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E2430",
  },

  personCountry: {
    marginTop: 3,
    fontSize: 11,
    color: "#B9A7B1",
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
    backgroundColor: "#F5DCE4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 17,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2E2430",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#6B5F68",
    textAlign: "center",
  },
  requestDetails: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FAECF1",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EBE7",
  },

  detailLabel: {
    fontSize: 13,
    color: "#6B5F68",
  },

  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2E2430",
    maxWidth: 180,
    textAlign: "right",
  },

  requestActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  rejectButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8C8C1",
    justifyContent: "center",
    alignItems: "center",
  },

  rejectButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D9456B",
  },

  acceptButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#D9456B",
    justifyContent: "center",
    alignItems: "center",
  },

  acceptButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
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
    backgroundColor: "#FFF8F5",
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
    backgroundColor: "#F5DCE4",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },

  modalCloseText: {
    fontSize: 23,
    color: "#D9456B",
    lineHeight: 25,
  },

  modalAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#F5DCE4",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 12,
  },

  modalAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#D9456B",
  },

  modalTitle: {
    marginTop: 15,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    color: "#2E2430",
    textAlign: "center",
  },

  modalSubtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#6B5F68",
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
    borderColor: "#F3DFE7",
  },

  relationshipSelected: {
    backgroundColor: "#D9456B",
    borderColor: "#D9456B",
  },

  relationshipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B5F68",
  },

  relationshipSelectedText: {
    color: "#FFFFFF",
  },

  connectButton: {
    height: 55,
    borderRadius: 14,
    backgroundColor: "#D9456B",
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
