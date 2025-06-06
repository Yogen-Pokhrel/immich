<script lang="ts">
  import AdminSettings from '$lib/components/admin-page/settings/admin-settings.svelte';
  import StorageTemplateSettings from '$lib/components/admin-page/settings/storage-template/storage-template-settings.svelte';
  import FormatMessage from '$lib/components/i18n/format-message.svelte';
  import { featureFlags } from '$lib/stores/server-config.store';
  import { user } from '$lib/stores/user.store';
  import { getConfig, type SystemConfigDto } from '@immich/sdk';
  import { Button } from '@immich/ui';
  import { mdiArrowLeft, mdiCheck, mdiHarddisk } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import OnboardingCard from './onboarding-card.svelte';

  interface Props {
    onDone: () => void;
    onPrevious: () => void;
  }

  let { onDone, onPrevious }: Props = $props();

  let config: SystemConfigDto | undefined = $state();
  let adminSettingsComponent = $state<ReturnType<typeof AdminSettings>>();

  onMount(async () => {
    config = await getConfig();
  });
</script>

<OnboardingCard title={$t('admin.storage_template_settings')} icon={mdiHarddisk}>
  <p>
    <FormatMessage key="admin.storage_template_onboarding_description">
      {#snippet children({ message })}
        <a class="underline" href="https://immich.app/docs/administration/storage-template">{message}</a>
      {/snippet}
    </FormatMessage>
  </p>

  {#if config && $user}
    <AdminSettings bind:config bind:this={adminSettingsComponent}>
      {#snippet children({ defaultConfig, savedConfig })}
        {#if config}
          <StorageTemplateSettings
            minified
            disabled={$featureFlags.configFile}
            {config}
            {defaultConfig}
            {savedConfig}
            onSave={(config) => adminSettingsComponent?.handleSave(config)}
            onReset={(options) => adminSettingsComponent?.handleReset(options)}
            duration={0}
          >
            <div class="flex pt-4">
              <div class="w-full flex place-content-start">
                <Button
                  shape="round"
                  leadingIcon={mdiArrowLeft}
                  class="flex gap-2 place-content-center"
                  onclick={() => onPrevious()}
                >
                  <p>{$t('privacy')}</p>
                </Button>
              </div>
              <div class="flex w-full place-content-end">
                <Button
                  shape="round"
                  trailingIcon={mdiCheck}
                  onclick={() => {
                    adminSettingsComponent?.handleSave({ storageTemplate: config?.storageTemplate });
                    onDone();
                  }}
                >
                  <span class="flex place-content-center place-items-center gap-2">
                    {$t('done')}
                  </span>
                </Button>
              </div>
            </div>
          </StorageTemplateSettings>
        {/if}
      {/snippet}
    </AdminSettings>
  {/if}
</OnboardingCard>
