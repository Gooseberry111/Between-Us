import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiFetch } from "../lib/api";
import {
  COVER_KEYS,
  KINDS,
  coverFor,
  newStepId,
  progressOf,
} from "../lib/dreams";
import { T } from "../lib/theme";
import {
  Button,
  Card,
  Cell,
  Check,
  Chip,
  Group,
  GroupFooter,
  GroupHeader,
  Icon,
  Press,
  Sheet,
} from "./ui";
import DateInput from "./DateInput";
import DreamCover from "./DreamCover";
import { photosAvailable, pickPhoto, uploadPhoto } from "./Photo";

/*
 * ==========================================
 * DREAM SHEET
 * ==========================================
 *
 * One sheet for a dream, new or old.
 *
 *   new          blank, or filled from a starter: its
 *                cover, kind and first steps already in
 *   existing     the same fields, plus Mark as Done,
 *                Focus on This and Delete
 *
 * The cover is a photo from the library or one of the
 * drawn covers; whichever was chosen last is the one
 * that shows.
 */

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export default function DreamSheet({
  visible,
  userId,
  dream,
  starter,
  isFocused,
  onClose,
  onChanged,
  onCompleted,
}) {
  const editing = Boolean(dream);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [kind, setKind] = useState("Other");
  const [cover, setCover] = useState("sunset");
  const [icon, setIcon] = useState(null);
  const [photoId, setPhotoId] = useState(null);
  const [localUri, setLocalUri] = useState(null);
  const [steps, setSteps] = useState([]);
  const [newStep, setNewStep] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [openedWith, setOpenedWith] = useState(null);

  const stepInput = useRef(null);

  /* Start from the dream, the starter, or nothing, each
   * time the sheet opens. */
  useEffect(() => {
    if (!visible) return;

    const source = dream || starter;

    const start = {
      title: source?.title || "",
      description: dream?.description || "",
      targetDate: dream?.target_date
        ? String(dream.target_date).slice(0, 10)
        : "",
      kind: dream?.category || starter?.kind || "Other",
      cover: dream ? coverFor(dream) : starter?.cover || "sunset",
      photoId: dream?.photo_id || null,
      steps: (source?.steps || []).map((step) => ({
        ...step,
        id: starter ? newStepId() : step.id,
      })),
      newStep: "",
    };

    setTitle(start.title);
    setDescription(start.description);
    setTargetDate(start.targetDate);
    setKind(start.kind);
    setCover(start.cover);
    setIcon(starter?.icon || null);
    setPhotoId(start.photoId);
    setLocalUri(null);
    setSteps(start.steps);
    setNewStep(start.newStep);
    setOpenedWith(JSON.stringify(start));
    setUploading(false);
    setBusy(null);
  }, [visible, dream, starter]);

  const progress = progressOf({ steps });

  /* Anything changed since it opened counts as unsaved. */
  const dirty =
    openedWith !== null &&
    JSON.stringify({
      title,
      description,
      targetDate,
      kind,
      cover,
      photoId,
      steps,
      newStep,
    }) !== openedWith;

  /* ---------- the cover ---------- */

  const choosePhoto = async () => {
    try {
      const picked = await pickPhoto({ aspect: [16, 10] });

      if (!picked) return;

      setLocalUri(picked.uri);
      setUploading(true);

      const id = await uploadPhoto(userId, picked.base64);

      setPhotoId(id);
    } catch (err) {
      setLocalUri(null);

      Alert.alert(
        "That photo didn't go up",
        err?.message || "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoId(null);
    setLocalUri(null);
  };

  const chooseCover = (key) => {
    setCover(key);
    setIcon(null);
    removePhoto();
  };

  /* ---------- steps ---------- */

  const addStep = () => {
    const text = newStep.trim();

    if (!text) return;

    setSteps((current) => [
      ...current,
      { id: newStepId(), title: text, done: false },
    ]);
    setNewStep("");

    requestAnimationFrame(() => stepInput.current?.focus());
  };

  const toggleStep = (id) =>
    setSteps((current) =>
      current.map((step) =>
        step.id === id ? { ...step, done: !step.done } : step,
      ),
    );

  const renameStep = (id, text) =>
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, title: text } : step)),
    );

  const removeStep = (id) =>
    setSteps((current) => current.filter((step) => step.id !== id));

  /* ---------- saving ---------- */

  const fields = () => {
    /* A step still being typed counts, so nothing written is lost. */
    const pending = newStep.trim()
      ? [{ id: newStepId(), title: newStep.trim(), done: false }]
      : [];

    return {
      clerk_id: userId,
      title: title.trim(),
      description: description.trim(),
      /* An empty string clears the date; null would leave it as it was. */
      target_date: targetDate.trim(),
      category: kind,
      cover,
      photo_id: photoId,
      steps: [...steps, ...pending]
        .map((step) => ({ ...step, title: step.title.trim() }))
        .filter((step) => step.title),
    };
  };

  const send = async (extra, label) => {
    if (busy || uploading) return null;

    const body = { ...fields(), ...extra };

    if (!body.title) {
      Alert.alert("Give it a name", "What is the dream?");
      return null;
    }

    if (body.target_date && !DATE_SHAPE.test(body.target_date)) {
      Alert.alert(
        "Check the date",
        "Write it as YYYY-MM-DD, or leave it blank.",
      );
      return null;
    }

    try {
      setBusy(label);

      const response = await apiFetch(
        editing
          ? `/users/${userId}/dreams/${dream.id}`
          : `/users/${userId}/dreams`,
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this dream.");
      }

      return data?.dream || true;
    } catch (err) {
      Alert.alert("We couldn't save that", err?.message || "Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const saved = await send({}, "save");

    if (!saved) return;

    onChanged?.();
    onClose();
  };

  const markDone = async () => {
    const saved = await send({ is_completed: true }, "done");

    if (!saved) return;

    onChanged?.();
    onClose();
    onCompleted?.(title.trim());
  };

  const focus = async () => {
    const saved = await send({ focus: true }, "focus");

    if (!saved) return;

    onChanged?.();
    onClose();
  };

  const remove = () => {
    Alert.alert(
      "Delete this dream?",
      "It comes off the board for both of you, steps and all.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy("delete");

              const response = await apiFetch(
                `/users/${userId}/dreams/${dream.id}`,
                { method: "DELETE" },
              );

              if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Unable to delete this dream.");
              }

              onChanged?.();
              onClose();
            } catch (err) {
              Alert.alert(
                "We couldn't delete that",
                err?.message || "Please try again.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const hasPhoto = Boolean(photoId || localUri);

  /* Steps as rows, then the row that adds one. Flattened,
   * so the group draws a separator between each. */
  const stepRows = [
    ...steps.map((step) => (
      <View key={step.id} style={styles.stepRow}>
        <Check
          on={step.done}
          onPress={() => toggleStep(step.id)}
          label={step.done ? "Mark not done" : "Mark done"}
        />

        <TextInput
          value={step.title}
          onChangeText={(text) => renameStep(step.id, text)}
          style={[styles.stepText, step.done && styles.stepTextDone]}
          placeholderTextColor={T.label3}
        />

        <Press
          onPress={() => removeStep(step.id)}
          hitSlop={10}
          scaleTo={0.85}
          accessibilityLabel="Remove step"
        >
          <Icon name="close" size={15} color={T.label3} />
        </Press>
      </View>
    )),

    <View key="add" style={styles.stepRow}>
      <View style={styles.stepAdd}>
        <Icon name="add" size={14} color={T.accent} />
      </View>

      <TextInput
        ref={stepInput}
        value={newStep}
        onChangeText={setNewStep}
        onSubmitEditing={addStep}
        placeholder="Add a step"
        placeholderTextColor={T.label3}
        returnKeyType="done"
        submitBehavior="submit"
        style={styles.stepText}
      />
    </View>,
  ];

  return (
    <Sheet
      visible={visible}
      title={editing ? "Edit Dream" : "New Dream"}
      onCancel={onClose}
      onSave={save}
      saveLabel={busy === "save" ? "Saving" : "Save"}
      saveDisabled={!title.trim() || uploading || Boolean(busy)}
      dirty={dirty}
    >
      {/* COVER */}

      <Card padded={false} style={styles.coverCard}>
        <DreamCover
          cover={cover}
          icon={icon}
          photoId={photoId}
          photoUrl={
            dream && photoId === dream.photo_id ? dream.photo_url : undefined
          }
          localUri={localUri}
          height={170}
          iconSize={40}
        >
          {uploading ? (
            <View style={styles.coverBusy}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}

          <View style={styles.coverActions}>
            {photosAvailable ? (
              <Press onPress={choosePhoto} scaleTo={0.94}>
                <View style={styles.coverPill}>
                  <Icon name="photo" size={14} color="#FFFFFF" />

                  <Text style={styles.coverPillText}>
                    {hasPhoto ? "Change Photo" : "Add Photo"}
                  </Text>
                </View>
              </Press>
            ) : null}

            {hasPhoto ? (
              <Press onPress={removePhoto} scaleTo={0.94}>
                <View style={styles.coverPill}>
                  <Text style={styles.coverPillText}>Remove</Text>
                </View>
              </Press>
            ) : null}
          </View>
        </DreamCover>
      </Card>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.swatches}
      >
        {COVER_KEYS.map((key) => {
          const selected = !hasPhoto && cover === key;

          return (
            <Press
              key={key}
              onPress={() => chooseCover(key)}
              scaleTo={0.92}
              accessibilityLabel={`${key} cover`}
            >
              <View style={[styles.swatch, selected && styles.swatchOn]}>
                <DreamCover cover={key} height={44} iconSize={16} radius={9} />
              </View>
            </Press>
          );
        })}
      </ScrollView>

      {/* WHAT IT IS */}

      <Group>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What do you want to do together?"
          placeholderTextColor={T.label3}
          style={styles.field}
        />

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Why it matters (optional)"
          placeholderTextColor={T.label3}
          style={[styles.field, styles.fieldTall]}
          multiline
          textAlignVertical="top"
        />

        <DateInput
          value={targetDate}
          onChangeText={setTargetDate}
          placeholder="By when? YYYY-MM-DD (optional)"
          style={styles.field}
        />
      </Group>

      <GroupHeader>Kind</GroupHeader>

      <View style={styles.kinds}>
        {KINDS.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={kind === item}
            onPress={() => setKind(item)}
          />
        ))}
      </View>

      {/* STEPS */}

      <GroupHeader>
        {progress.total
          ? `Steps · ${progress.done} of ${progress.total}`
          : "Steps"}
      </GroupHeader>

      <Group inset={50}>{stepRows}</Group>

      <GroupFooter>
        Small steps fill the ring on your board. Either of you can tick one.
      </GroupFooter>

      {/* ACTIONS */}

      {editing ? (
        <>
          <Button
            title={busy === "done" ? "One moment…" : "Mark as Done"}
            icon="checkCircle"
            onPress={markDone}
            busy={busy === "done"}
          />

          <Group inset={52}>
            {!isFocused ? (
              <Cell
                leading={<Icon name="target" size={20} color={T.accent} />}
                title="Focus on This One"
                subtitle="Puts it at the top of your board"
                onPress={focus}
              />
            ) : null}

            <Cell
              leading={<Icon name="trash" size={20} color={T.red} />}
              title="Delete Dream"
              destructive
              onPress={remove}
            />
          </Group>
        </>
      ) : (
        <Button
          title="Add to the Board"
          onPress={save}
          busy={busy === "save"}
          disabled={!title.trim() || uploading}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  coverCard: {
    overflow: "hidden",
  },

  coverBusy: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  coverActions: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    gap: 8,
  },

  coverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  coverPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  swatches: {
    paddingHorizontal: 16,
    gap: 10,
    marginTop: -4,
  },

  swatch: {
    width: 66,
    padding: 2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },

  swatchOn: {
    borderColor: T.accent,
  },

  field: {
    fontSize: 17,
    color: T.label,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },

  fieldTall: {
    minHeight: 92,
  },

  kinds: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },

  stepAdd: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },

  stepText: {
    flex: 1,
    fontSize: 17,
    color: T.label,
    paddingVertical: 12,
  },

  stepTextDone: {
    color: T.label2,
  },
});
