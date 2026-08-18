import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";

const API_URL = "https://between-us-api.between-us.workers.dev";

export default function FindPersonScreen() {
  const { user } = useUser();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    if (!user) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/search-users?clerk_id=${encodeURIComponent(
          user.id,
        )}&search=${encodeURIComponent(search.trim())}`,
      );

      const data = await response.json();

      console.log("SEARCH RESPONSE:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to search users.");
      }

      setResults(data);
    } catch (error) {
      console.log("SEARCH ERROR:", error);

      Alert.alert(
        "Search failed",
        error?.message || "Something went wrong while searching.",
      );
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() =>
          router.push({
            pathname: "/connect-person",
            params: {
              userId: item.id,
              name: item.first_name,
            },
          })
        }
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.first_name?.charAt(0)?.toUpperCase()}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.name}>{item.first_name}</Text>

          <Text style={styles.details}>{item.country}</Text>

          <Text style={styles.status}>{item.relationship_status}</Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Find Your Person</Text>

        <Text style={styles.subtitle}>
          Search for the person you want to connect with.
        </Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by first name"
            placeholderTextColor="#9A918A"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={searchUsers}
          />

          <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="small" style={styles.loader} />}

        {!loading && search.length > 0 && results.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one found</Text>

            <Text style={styles.emptyText}>
              Try checking the spelling or searching another name.
            </Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
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
    paddingTop: 20,
  },

  backButton: {
    marginBottom: 18,
  },

  backText: {
    color: "#6B4E45",
    fontSize: 16,
    fontWeight: "600",
  },

  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#817771",
    marginBottom: 24,
  },

  searchContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  searchInput: {
    flex: 1,
    height: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2DAD3",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#302825",
  },

  searchButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#6B4E45",
    justifyContent: "center",
    alignItems: "center",
  },

  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  loader: {
    marginVertical: 20,
  },

  list: {
    paddingBottom: 30,
  },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E9DED8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6B4E45",
  },

  userInfo: {
    flex: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 3,
  },

  details: {
    fontSize: 13,
    color: "#817771",
    marginBottom: 2,
  },

  status: {
    fontSize: 12,
    color: "#A0958E",
  },

  arrow: {
    fontSize: 28,
    color: "#9A918A",
  },

  empty: {
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 30,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#302825",
    marginBottom: 8,
  },

  emptyText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#817771",
  },
});
