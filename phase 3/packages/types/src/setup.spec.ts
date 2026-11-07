import { APP_NAME } from './index';

describe('Unit runner', () => {
  it('T-SETUP-1 runs an example unit test through npm run test:unit', () => {
    expect(APP_NAME).toBe('Pholo CMS');
  });
});
