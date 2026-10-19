import {
  Button,
  Form,
  HStack,
  Host,
  Image,
  Label,
  LabeledContent,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  scrollContentBackground,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { T } from "../lib/theme";

/*
 * ==========================================
 * PROFILE FORM (iOS)
 * ==========================================
 *
 * Profile is Settings, so on iOS it is drawn by
 * SwiftUI's Form -- the same component Settings is
 * built from. Grouped sections, real switches, rows
 * that highlight the way system rows do, and a red
 * destructive button that asks before it acts.
 *
 * Android uses ProfileForm.js, which draws the same
 * structure with the app's own grouped list.
 */

export default function ProfileForm({
  fullName,
  subtitle,
  partnerName,
  relationship,
  togetherSince,
  connected,
  reminders,
  prefs,
  busy,
  onAccount,
  onNudge,
  onFindPerson,
  onReminder,
  onOpen,
  onUnlink,
  onSignOut,
  onDelete,
}) {
  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement seedColor={T.accent}>
      <Form modifiers={[scrollContentBackground("hidden"), tint(T.accent)]}>
        {/* ACCOUNT */}
        <Section>
          <Button onPress={onAccount} modifiers={[buttonStyle("plain")]}>
            <HStack spacing={14}>
              <Image
                systemName="person.crop.circle.fill"
                size={52}
                color={T.you}
              />

              <VStack alignment="leading" spacing={2}>
                <Text modifiers={[font({ size: 20, weight: "semibold" })]}>
                  {fullName || "Your account"}
                </Text>

                {subtitle ? (
                  <Text
                    modifiers={[font({ size: 13 }), foregroundStyle("#8A8A8E")]}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </VStack>

              <Spacer />
            </HStack>
          </Button>
        </Section>

        {/* PARTNER */}
        <Section>
          {connected ? (
            <HStack spacing={12}>
              <Label title={partnerName} systemImage="heart.circle.fill" />

              <Spacer />

              <Button
                label="Nudge"
                onPress={onNudge}
                modifiers={[buttonStyle("bordered"), controlSize("small")]}
              />
            </HStack>
          ) : (
            <Button onPress={onFindPerson} modifiers={[buttonStyle("plain")]}>
              <Label title="Find your person" systemImage="person.badge.plus" />
            </Button>
          )}
        </Section>

        {/* REMINDERS */}
        <Section title="Reminders">
          {reminders.map((reminder) => (
            <Toggle
              key={reminder.type}
              label={reminder.title}
              systemImage={reminder.sf}
              isOn={prefs?.[reminder.type] !== false}
              onIsOnChange={(value) => onReminder(reminder.type, value)}
            />
          ))}
        </Section>

        {/* YOUR SPACE */}
        <Section title="Your space">
          <Button onPress={() => onOpen("/(tabs)/memories")}>
            <Label title="Timeline" systemImage="clock" />
          </Button>

          <Button onPress={() => onOpen("/(tabs)/dreams")}>
            <Label title="Dreams" systemImage="sparkles" />
          </Button>

          <Button onPress={() => onOpen("/dates")}>
            <Label title="Dates" systemImage="calendar" />
          </Button>

          <Button onPress={() => onOpen("/goals")}>
            <Label title="Goals" systemImage="flag" />
          </Button>

          <Button onPress={() => onOpen("/trivia-history")}>
            <Label title="Trivia" systemImage="sparkles" />
          </Button>

          <Button onPress={() => onOpen("/check-in")}>
            <Label title="Weekly check-in" systemImage="waveform.path.ecg" />
          </Button>

          <Button onPress={() => onOpen("/answers")}>
            <Label title="Your answers" systemImage="square.and.pencil" />
          </Button>

          <Button onPress={() => onOpen("/notification-settings")}>
            <Label title="All notifications" systemImage="bell" />
          </Button>
        </Section>

        {/* RELATIONSHIP */}
        {connected ? (
          <Section
            title="Relationship"
            footer={
              <Text>
                Unlinking closes your shared space. Link again with the same
                person and it all comes back.
              </Text>
            }
          >
            <LabeledContent label="Status">
              <Text>{relationship}</Text>
            </LabeledContent>

            <LabeledContent label="Together since">
              <Text>{togetherSince}</Text>
            </LabeledContent>

            <Button
              label={busy ? "Working…" : "Unlink Partner"}
              role="destructive"
              onPress={onUnlink}
            />
          </Section>
        ) : null}

        {/* ACCOUNT ACTIONS */}
        <Section title="Account">
          <Button label="Terms of Use" onPress={() => onOpen("/terms")} />

          <Button label="Privacy Policy" onPress={() => onOpen("/privacy")} />

          <Button label="Sign Out" onPress={onSignOut} />

          <Button
            label="Delete Account"
            role="destructive"
            onPress={onDelete}
          />
        </Section>
      </Form>
    </Host>
  );
}
