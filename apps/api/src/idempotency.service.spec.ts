import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService',()=>{
  const service=new IdempotencyService();
  it('hashes semantically identical object key order the same',()=>{
    expect(service.payloadHash({b:2,a:{y:2,x:1}})).toBe(service.payloadHash({a:{x:1,y:2},b:2}));
  });
  it('changes the hash when a financial payload changes',()=>{
    expect(service.payloadHash({amount:'10.00'})).not.toBe(service.payloadHash({amount:'10.01'}));
  });
});
