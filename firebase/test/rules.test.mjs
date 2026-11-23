// Verifies firestore.rules against the Firebase emulator.
// Run from /firebase with: npm test
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const ALICE = 'alice';
const BOB = 'bob';

let testEnv;

const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const decisionRef = (uid, id = 'd1') =>
  doc(db(uid), 'users', uid, 'decisions', id);

function baseDecision(overrides = {}) {
  return {
    title: 'Take the job offer',
    options: ['take', 'decline'],
    reasoning: 'The team is strong and the commute is short.',
    prediction: 'I will still be there in a year',
    confidence: 70,
    state: 'calm',
    tags: ['work'],
    reviewDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
    postponedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'open',
    review: null,
    ...overrides,
  };
}

function review(overrides = {}) {
  return {
    reviewedAt: serverTimestamp(),
    outcome: 'I am still there and enjoying it',
    predictionResult: 'yes',
    reasoningRating: 'sound',
    lesson: 'Ask about the on-call rota earlier.',
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-decision-journal',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8081,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('authentication', () => {
  it('blocks a signed-out client from reading and writing', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users', ALICE, 'decisions', 'd1')));
    await assertFails(
      setDoc(doc(anon, 'users', ALICE, 'decisions', 'd1'), baseDecision()),
    );
  });

  it('stops one user reading another user’s decisions', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertFails(
      getDoc(doc(db(BOB), 'users', ALICE, 'decisions', 'd1')),
    );
  });

  it('keeps settings private', async () => {
    await assertSucceeds(
      setDoc(doc(db(ALICE), 'users', ALICE, 'settings', 'preferences'), {
        reminderTime: '09:00',
        defaultReviewDays: 30,
      }),
    );
    await assertFails(getDoc(doc(db(BOB), 'users', ALICE, 'settings', 'preferences')));
  });
});

describe('creating a decision', () => {
  it('accepts a valid decision', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
  });

  it('rejects a missing required field', async () => {
    const missing = baseDecision();
    delete missing.prediction;
    await assertFails(setDoc(decisionRef(ALICE), missing));
  });

  it('rejects confidence outside 0–100', async () => {
    await assertFails(
      setDoc(decisionRef(ALICE), baseDecision({ confidence: 120 })),
    );
  });

  it('rejects a decision created already reviewed', async () => {
    await assertFails(
      setDoc(
        decisionRef(ALICE),
        baseDecision({ status: 'reviewed', review: review() }),
      ),
    );
  });

  it('rejects a device clock on createdAt', async () => {
    await assertFails(
      setDoc(decisionRef(ALICE), baseDecision({ createdAt: new Date() })),
    );
  });
});

describe('editing while open', () => {
  it('allows changing an original field', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(
      updateDoc(decisionRef(ALICE), {
        title: 'Take the job offer after all',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses to move the review date without postponing', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        reviewDate: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 3600 * 1000)),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('postponing', () => {
  it('allows one postponement', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(
      updateDoc(decisionRef(ALICE), {
        reviewDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        postponedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('rejects a second postponement', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(
      updateDoc(decisionRef(ALICE), {
        reviewDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        postponedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        reviewDate: Timestamp.fromDate(new Date(Date.now() + 60 * 24 * 3600 * 1000)),
        postponedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('rejects clearing postponedAt', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(
      updateDoc(decisionRef(ALICE), {
        reviewDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
        postponedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        postponedAt: null,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('reviewing', () => {
  const closeIt = (uid = ALICE) =>
    updateDoc(decisionRef(uid), {
      status: 'reviewed',
      review: review(),
      updatedAt: serverTimestamp(),
    });

  it('allows the one-way transition to reviewed', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(closeIt());
  });

  it('rejects an invalid prediction result', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        status: 'reviewed',
        review: review({ predictionResult: 'maybe' }),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('rejects changing an original field as part of the review', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        status: 'reviewed',
        title: 'Rewritten with hindsight',
        review: review(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('makes a reviewed decision read-only and undeletable', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(closeIt());
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        title: 'Rewritten with hindsight',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        review: review({ outcome: 'Actually something else' }),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(decisionRef(ALICE)));
  });

  it('rejects reopening a reviewed decision', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(closeIt());
    await assertFails(
      updateDoc(decisionRef(ALICE), {
        status: 'open',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('deleting', () => {
  it('allows deleting an open decision', async () => {
    await assertSucceeds(setDoc(decisionRef(ALICE), baseDecision()));
    await assertSucceeds(deleteDoc(decisionRef(ALICE)));
  });
});
