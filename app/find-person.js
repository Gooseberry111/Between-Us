import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";

import { apiFetch } from "../lib/api";
import { T } from "../lib/theme";
import {
  Avatar,
  Button,
  Cell,
  Empty,
  GlassButton,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  LargeTitle,
  NavBar,
  Notice,
  Screen,
  SearchField,
  Sheet,
  SubTitle,
} from "../components/ui";

/*
 * ==========================================
 * FIND YOUR PERSON
 * ==========================================
 *
 * Search as you type, by name or email. Anyone who has
 * already asked for you sits at the top; tap them to see
 * who they are and accept or decline. Tap a result to say
 * what you are to each other and send a request. Nothing
 * is shared until the other person accepts.
 */

const relationshipTypes = ["Friendship", "Dating", "Engaged", "Married"];

/* The API ignores anything shorter, to stop a single
 * letter listing everybody. */
const MIN_QUERY_LENGTH = 2;

const HOW_IT_WORKS = [
  {
    icon: "search",
    title: "Their first name is enough",
    text: "Matches appear as you type",
  },
  {
    icon: "mail",
    title: "Or use their email",
    text: "An exact address finds just them",
  },
  {
    icon: "lock",
    title: "Then send a request",
    text: "Nothing is shared until they accept",
  },
];

function titleCase(text) {
  const value = String(text || "").trim();

  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
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

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load connection requests.");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
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

      if (!response.ok) {
        throw new Error(data?.error || "Unable to accept request.");
      }

      setSuccess("Connection accepted.");

      setSelectedRequest(null);

      await loadRequests();
    } catch (err) {
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

      if (!response.ok) {
        throw new Error(data?.error || "Unable to reject request.");
      }

      setSuccess("Connection request rejected.");

      setSelectedRequest(null);

      await loadRequests();
    } catch (err) {
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
      setError(
        err?.message || "Something went wrong while sending the request.",
      );
    } finally {
      setSendingId(null);
    }
  };

  if (!isLoaded) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={T.accent} />
        </View>
      </Screen>
    );
  }

  const trimmed = query.trim();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const closePerson = () => {
    setSelectedPerson(null);
    setRelationshipType("");
    setError("");
  };

  return (
    <>
      <Screen>
        <NavBar
          left={
            router.canGoBack() ? (
              <GlassButton icon="back" label="Back" onPress={goBack} />
            ) : null
          }
        />

        <LargeTitle>Find your person</LargeTitle>

        <SubTitle>Search by name or email.</SubTitle>

        <SearchField
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setError("");
            setSuccess("");
          }}
          busy={searching}
          placeholder="Name or email"
        />

        <Notice>{error}</Notice>

        <Notice tone="info">{success}</Notice>

        {/* WHO HAS ASKED FOR YOU */}

        {!loadingRequests && requests.length > 0 ? (
          <>
            <GroupHeader>
              {requests.length === 1
                ? "Wants to connect"
                : `${requests.length} want to connect`}
            </GroupHeader>

            <Group inset={68}>
              {requests.map((item) => {
                const name = item.requester_first_name?.trim() || "Someone";

                return (
                  <Cell
                    key={item.id}
                    leading={<Avatar name={name} who="you" size={40} />}
                    title={name}
                    subtitle={[
                      titleCase(item.relationship_type),
                      "wants to connect with you",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    chevron
                    onPress={() => viewRequest(item)}
                  />
                );
              })}
            </Group>
          </>
        ) : null}

        {/* RESULTS */}

        {results.length > 0 ? (
          <>
            <GroupHeader>People</GroupHeader>

            <Group inset={68}>
              {results.map((item) => {
                const sent = item.request_state === "sent";
                const received = item.request_state === "received";
                const sending = sendingId === item.clerk_id;

                const theirRequest = received
                  ? requests.find(
                      (request) => request.requester_clerk_id === item.clerk_id,
                    )
                  : null;

                return (
                  <Cell
                    key={item.clerk_id}
                    leading={
                      <Avatar name={item.first_name} who="them" size={40} />
                    }
                    title={item.first_name}
                    subtitle={[item.country, item.relationship_status]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={
                      sending ? (
                        <ActivityIndicator color={T.accent} />
                      ) : (
                        <View
                          style={[
                            styles.pill,
                            sent && styles.pillDone,
                            received && styles.pillAsked,
                          ]}
                        >
                          {sent ? (
                            <Icon name="check" size={12} color={T.label2} />
                          ) : null}

                          <Text
                            style={[
                              styles.pillText,
                              sent && styles.pillTextDone,
                              received && styles.pillTextAsked,
                            ]}
                          >
                            {sent
                              ? "Requested"
                              : received
                                ? "Asked You"
                                : "Connect"}
                          </Text>
                        </View>
                      )
                    }
                    onPress={
                      sent
                        ? undefined
                        : () =>
                            theirRequest
                              ? viewRequest(theirRequest)
                              : selectPerson(item)
                    }
                  />
                );
              })}
            </Group>

            <GroupFooter>
              People already linked with someone else don&apos;t show up.
            </GroupFooter>
          </>
        ) : searching ? null : trimmed.length === 1 ? (
          <GroupFooter>One more letter and matches start showing.</GroupFooter>
        ) : trimmed.length >= MIN_QUERY_LENGTH ? (
          <Empty
            icon="person"
            title={`No one called “${trimmed}”`}
            text="Check the spelling, try their email, or ask them to make their account first."
          />
        ) : requests.length === 0 && !loadingRequests ? (
          <>
            <GroupHeader>How it works</GroupHeader>

            <Group inset={62}>
              {HOW_IT_WORKS.map((tip) => (
                <Cell
                  key={tip.title}
                  leading={
                    <View style={styles.badge}>
                      <Icon name={tip.icon} size={16} color={T.accent} />
                    </View>
                  }
                  title={tip.title}
                  subtitle={tip.text}
                />
              ))}
            </Group>
          </>
        ) : null}
      </Screen>

      {/* SOMEONE ASKED FOR YOU */}

      <Sheet
        visible={Boolean(selectedRequest)}
        title="Request"
        onCancel={() => setSelectedRequest(null)}
      >
        {selectedRequest ? (
          <>
            <View style={styles.who}>
              <Avatar
                name={selectedRequest.requester_first_name}
                who="you"
                size={76}
              />

              <Text style={styles.whoName}>
                {selectedRequest.requester_first_name?.trim() || "Someone"}
              </Text>

              <Text style={styles.whoLine}>wants to connect with you</Text>
            </View>

            <Group>
              <Cell
                title="Relationship"
                value={
                  titleCase(selectedRequest.relationship_type) || "Not said"
                }
              />

              <Cell
                title="Country"
                value={selectedRequest.requester_country?.trim() || "Not said"}
              />

              <Cell
                title="Gender"
                value={selectedRequest.requester_gender || "Not said"}
              />

              <Cell
                title="Status"
                value={
                  selectedRequest.requester_relationship_status || "Not said"
                }
              />
            </Group>

            <GroupFooter>
              Accepting links your accounts. You can unlink later from Profile.
            </GroupFooter>

            <Notice>{error}</Notice>

            <Button
              title="Accept"
              icon="heart"
              onPress={acceptRequest}
              busy={processingRequest}
            />

            <Button
              title="Decline"
              kind="plain"
              onPress={rejectRequest}
              disabled={processingRequest}
            />
          </>
        ) : null}
      </Sheet>

      {/* ASKING SOMEONE */}

      <Sheet
        visible={Boolean(selectedPerson)}
        title="Connect"
        onCancel={closePerson}
        onSave={sendRequest}
        saveLabel="Send"
        saveDisabled={!relationshipType || Boolean(sendingId)}
      >
        {selectedPerson ? (
          <>
            <View style={styles.who}>
              <Avatar name={selectedPerson.first_name} who="them" size={76} />

              <Text style={styles.whoName}>
                Connect with {selectedPerson.first_name}?
              </Text>

              <Text style={styles.whoLine}>What are you to each other?</Text>
            </View>

            <Group>
              {relationshipTypes.map((type) => (
                <Cell
                  key={type}
                  title={type}
                  trailing={
                    relationshipType === type ? (
                      <Icon name="check" size={18} color={T.accent} />
                    ) : null
                  }
                  onPress={() => setRelationshipType(type)}
                />
              ))}
            </Group>

            <GroupFooter>
              They see your first name and this. Nothing else until they accept.
            </GroupFooter>

            <Notice>{error}</Notice>

            <Button
              title="Send Request"
              icon="send"
              onPress={sendRequest}
              busy={Boolean(sendingId)}
              disabled={!relationshipType}
            />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingTop: 80,
    alignItems: "center",
  },

  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: T.fill3,
  },

  pillDone: {
    backgroundColor: "transparent",
    paddingHorizontal: 4,
  },

  pillAsked: {
    backgroundColor: T.youTint,
  },

  pillText: {
    fontSize: 14,
    fontWeight: "700",
    color: T.accent,
  },

  pillTextDone: {
    fontWeight: "500",
    color: T.label2,
  },

  pillTextAsked: {
    color: T.youText,
  },

  who: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 6,
  },

  whoName: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: T.label,
    textAlign: "center",
    marginTop: 12,
  },

  whoLine: {
    fontSize: 15,
    color: T.label2,
    marginTop: 4,
    textAlign: "center",
  },
});
