import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

// Mock Pinia stores and tools used by the component
vi.mock('src/stores/appDataStore', () => ({
  useAppDataStore: () => ({
    data: {
      groups: [],
      scenes: [],
    },
  }),
}));

vi.mock('src/stores/controllersStore', () => ({
  useControllersStore: () => ({
    data: [],
  }),
}));

vi.mock('src/services/tools.js', () => ({
  getControllersInGroup: vi.fn(() => []),
}));

// Import the component under test
import SceneDialog from '../components/Dialogs/sceneDialog.vue';

// Helper to create a scene prop with mixed types and extra keys
const makeScene = () => ({
  id: 'scene-1',
  name: 'Snapshot test',
  group_id: 'gid-1',
  ts: Date.now(),
  favorite: false,
  icon: 'scene',
  defaultTransition: { d: '0', t: 0, s: 0, cmd: null, q: null, r: 'false' },
  settings: [
    {
      controller_id: 2827530,
      pos: 0,
      transition: { d: '0', t: 0, s: 0, cmd: null, q: null, r: 'false' },
      color: { hsv: { h: 0, s: 88, v: 85 } },
    },
    {
      controller_id: '4599343',
      pos: 1,
      transition: { d: 0, t: 0, r: false },
      color: { hsv: { s: 0, v: 0, h: 0, ct: 3620 } },
    },
    {
      controller_id: 777,
      pos: 2,
      transition: { d: 0, t: 10000, cmd: 'fade', r: false },
      color: { hsv: { h: 229, s: 84, v: 82 } },
    },
  ],
});

describe('sceneDialog serialization', () => {
  it('emits schema-compliant payload on save', async () => {
    const wrapper = shallowMount(SceneDialog, {
      props: { scene: makeScene() },
      global: {
        stubs: {
          // Stub Quasar and child components used in template
          'q-dialog': true,
          'q-card': true,
          'q-toolbar': true,
          'q-toolbar-title': true,
          'q-btn': true,
          'q-scroll-area': true,
          'q-card-section': true,
          'q-tooltip': true,
          'q-card-actions': true,
          'q-space': true,
          svgIcon: true,
          'controller-item': true,
          'transition-panel': true,
          mySelect: true,
        },
      },
    });

    // Trigger save
    // @ts-expect-error access exposed method
    wrapper.vm.onSaveClick();

    const emitted = wrapper.emitted('ok');
    expect(emitted).toBeTruthy();
    const payload = emitted![0][0];

    // Top-level transition exists and has no null cmd/q
    expect(payload.transition).toBeTruthy();
    expect(payload.transition.cmd).toBeUndefined();
    expect(payload.transition.q).toBeUndefined();
    expect(typeof payload.transition.d).toBe('number');
    expect(typeof payload.transition.r).toBe('boolean');

    // defaultTransition removed
    expect(payload.defaultTransition).toBeUndefined();

    // Settings processed
    expect(Array.isArray(payload.settings)).toBe(true);
    for (const s of payload.settings) {
      // controller_id is string
      expect(typeof s.controller_id).toBe('string');
      // pos removed
      expect(s.pos).toBeUndefined();
      // transition normalized and pruned
      if (s.transition) {
        expect(typeof s.transition.d).toBe('number');
        expect(typeof s.transition.r).toBe('boolean');
        if (s.transition.cmd === undefined) {
          expect(s.transition.cmd).toBeUndefined();
        }
        if (s.transition.q === undefined) {
          expect(s.transition.q).toBeUndefined();
        }
      }
    }

    // ct retained when numeric
    const withCt = payload.settings.find(
      (s: any) => s.color?.hsv?.ct !== undefined,
    );
    expect(withCt?.color?.hsv?.ct).toBe(3620);
  });
});
