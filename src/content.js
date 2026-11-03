// All copy and image slots live here. Replace `photo: null` with an image URL
// (portrait, roughly 3:4) to swap a placeholder for a real frame.

const TITLES = [
  'Window Seat', 'Sense of Order', 'Low Tide', 'Paper Lanterns', 'Under the Snowline',
  'Night Market', 'Two Coffees', 'Late Bus', 'Salt Air', 'Hallway Light',
  'Kite Season', 'First Frost', 'Old Bridge', 'Platform 4', 'Golden Hour',
  'Rain on Glass', 'Quiet Street', 'Morning Field', 'Harbour Wind', 'Lantern Walk',
  'Pine Shade', 'Backlit', 'Slow Rooftop', 'Last Light',
];

function frames(rollIndex, startMonth) {
  return Array.from({ length: 24 }, (_, i) => {
    const day = ((i * 7 + rollIndex * 5) % 27) + 1;
    const month = startMonth + Math.floor(i / 8);
    return {
      date: `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
      title: TITLES[(i + rollIndex * 6) % TITLES.length],
      photo: null,
    };
  });
}

export const ROLLS = [
  {
    id: 'mature', name: 'Mature', no: '01', mode: 'develop',
    label: { paper: '#ece2cc', ink: '#8c2c18', line: '#b9a98a' },
    hint: 'drag the film out, the lamp develops whatever comes through',
    frames: frames(0, 3),
  },
  {
    id: 'slow', name: 'slow days', no: '02', mode: 'light',
    label: { paper: '#c8411f', ink: '#3b0c05', line: '#e0805f' },
    hint: 'tap a frame to hold it up to the light, move to tilt it',
    frames: frames(1, 6),
  },
  {
    id: 'far', name: 'far away', no: '03', mode: 'viewer',
    label: { paper: '#1f3628', ink: '#d6c38c', line: '#5d7a5f' },
    hint: 'press the lever, one frame at a time',
    frames: frames(2, 9),
  },
  {
    id: 'still', name: 'still us', no: '04', mode: 'contact',
    label: { paper: '#17191c', ink: '#e8e1cf', line: '#4b4e52' },
    hint: 'circle the ones to print, a heart just means you love it',
    frames: frames(3, 10),
  },
];

export const COPY = {
  title: 'Four rolls,',
  titleItalic: 'one us',
  subtitle: 'every season we kept, wound up and waiting',
  pickOne: 'pick one',
  stillDecides: 'pick one, still us decides what gets printed',
  toDarkroom: 'to the darkroom',
  back: 'back to the table',
  lightbox: 'slide the loupe over a frame, tap to look closer',
  printThem: "now, let's print them",
  trayStart: 'tap the paper to start',
  wait: 'wait for it, or rock the tray to hurry it',
  next: 'tap the paper for the next one',
  readBack: 'tap a print to read the back',
  hangBack: 'tap again to hang it back',
  allDry: 'all dry,',
  toWall: 'to the wall',
  wallHint: 'tap anywhere',
  rewind: 'wind it back',
};

// The back of each print. Indexed by print order in the tray.
export const NOTES = [
  { date: '10/05', text: 'Placeholder note. Write what the city sounded like that evening, and who was quiet first.' },
  { date: '10/17', text: 'Placeholder note. A small line about a shadow on the wall, and why it was enough.' },
  { date: '11/02', text: 'Placeholder note. The mountain was not the point. You were laughing at the wind.' },
  { date: '11/21', text: 'Placeholder note. Golden grass, a long road, nobody in a hurry for once.' },
  { date: '12/09', text: 'Placeholder note. One more frame we almost did not take.' },
  { date: '12/30', text: 'Placeholder note. The last light of the year, slightly out of focus.' },
];

export const LETTER = {
  to: 'Dear you,',
  paragraphs: [
    'This is a placeholder letter. Some things are easier to keep on film than to say out loud, so these frames say them for me.',
    'Ninety-six frames.\nA few too warm,\na few a little soft.',
    'Exactly the way I remember us.',
  ],
  sign: '— me',
};
