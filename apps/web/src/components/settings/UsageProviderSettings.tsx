import { Switch } from "../ui/switch";
import { useUiText } from "~/i18n/useUiText";

import type { EnvironmentId, UnifiedSettings } from "@t3tools/contracts";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { useUpdateEnvironmentSettings } from "../../hooks/useSettings";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { AddUsageLimitSourceDialog } from "./AddUsageLimitSourceDialog";
import { searchableSetting } from "./settingsSearch";
import { SettingsRow, SettingsSection } from "./settingsLayout";

export function UsageProviderSettings({
  environmentId,
  environmentLabel,
  sources,
  cursorKeychainUsageEnabled,
  readOnly,
}: {
  readonly environmentId: EnvironmentId;
  readonly environmentLabel: string;
  readonly sources: UnifiedSettings["usageLimitSources"];
  readonly readOnly: boolean;
  readonly cursorKeychainUsageEnabled: boolean;
}) {
  const uiText = useUiText();
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const [adding, setAdding] = useState(false);
  const entries = Object.entries(sources);

  return (
    <>
      <SettingsSection
        {...searchableSetting("usage-providers")}
        headerAction={
          !readOnly ? (
            <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
              <PlusIcon className="size-3" aria-hidden />
              Add hub
            </Button>
          ) : null
        }
      >
        <SettingsRow
          title={uiText("Read Cursor account usage")}
          description={uiText(
            "Uses your existing Cursor CLI sign-in from the macOS Keychain to show usage and monthly limits. macOS may ask for permission.",
          )}
          control={
            <Switch
              checked={cursorKeychainUsageEnabled}
              disabled={readOnly}
              onCheckedChange={(enabled) => updateSettings({ cursorKeychainUsageEnabled: enabled })}
              aria-label={uiText("Read Cursor account usage")}
            />
          }
        />
        {entries.length === 0 ? (
          <SettingsRow title="No hubs configured." />
        ) : (
          entries.map(([id, source]) => {
            const label = source.label?.trim() || source.url;
            return (
              <SettingsRow
                key={id}
                title={label}
                description={
                  <span className={"break-all"}>
                    {uiText("CLI Proxy")}
                    {source.enabled ? "" : uiText("· Disabled")}
                    {label !== source.url ? ` · ${source.url}` : ""}
                  </span>
                }
                control={
                  !readOnly ? (
                    <RemoveUsageProviderButton
                      label={label}
                      onConfirm={() => updateSettings({ usageLimitSources: { [id]: null } })}
                    />
                  ) : null
                }
              />
            );
          })
        )}
      </SettingsSection>
      {adding && !readOnly ? (
        <AddUsageLimitSourceDialog
          open
          onOpenChange={setAdding}
          environmentId={environmentId}
          environmentLabel={environmentLabel}
          sources={sources}
        />
      ) : null}
    </>
  );
}

function RemoveUsageProviderButton({
  label,
  onConfirm,
}: {
  readonly label: string;
  readonly onConfirm: () => void;
}) {
  const uiText = useUiText();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={"xs"} variant={"ghost"} onClick={() => setOpen(true)}>
        {uiText("Remove")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {uiText("Remove")}
              {label}
              {"?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {uiText(
                "The hub's management key is deleted from this server. Its accounts leave the Limits view; the hub itself is untouched. Add it again with the URL and key to bring them back.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant={"outline"} />}>
              {uiText("Cancel")}
            </AlertDialogClose>
            <Button
              variant={"destructive"}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {uiText("Remove hub")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
