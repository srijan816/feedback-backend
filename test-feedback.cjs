const Queue = require('bull');

const feedbackQueue = new Queue('feedback', {
  redis: { host: 'localhost', port: 6379 }
});

const jobData = {
  speech_id: 10,
  transcript_id: 1,
  debate_id: '5b1e775a-5926-4f6a-8a86-7d58b7a60fc8',
  motion: 'This house would cry',
  speaker_position: 'Opp 2',
  student_level: 'secondary'
};

console.log('Adding feedback job to queue...');
feedbackQueue.add(jobData, { priority: 1, attempts: 3 })
  .then((job) => {
    console.log(`Job ${job.id} added to queue successfully`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
