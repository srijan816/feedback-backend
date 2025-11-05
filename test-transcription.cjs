const Queue = require('bull');

const transcriptionQueue = new Queue('transcription', {
  redis: { host: 'localhost', port: 6379 }
});

const jobData = {
  speech_id: 11,
  audio_file_path: 'storage/fa10cfe5-9539-438c-878f-fcf80df8a1b1_1761590155613.m4a',
  speaker_name: 'Sdfsd',
  speaker_position: 'Prop 1'
};

console.log('Adding transcription job to queue...');
transcriptionQueue.add(jobData, { priority: 1, attempts: 3 })
  .then((job) => {
    console.log(`Job ${job.id} added to queue successfully`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
