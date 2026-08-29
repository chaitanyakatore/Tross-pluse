import { app } from './app';
import { env } from './config/env';

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Profile API server running on port ${PORT}`);
  console.log(`📚 Interactive Swagger documentation available at http://localhost:${PORT}/docs`);
});
