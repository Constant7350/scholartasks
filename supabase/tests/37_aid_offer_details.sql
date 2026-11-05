-- Aid offer details accept the letter's numbers and refuse anything else.
do $$
begin
  assert aid_offer_detail_ok(null);
  assert aid_offer_detail_ok('{"coa": 30000, "grants": 12000, "student_loans": 5500, "parent_loans": null, "work_study": 2000, "notes": "Pell included"}');
  assert not aid_offer_detail_ok('{"coa": -5}');
  assert not aid_offer_detail_ok('{"coa": "lots"}');
  assert not aid_offer_detail_ok('{"ssn": "123"}');
  assert not aid_offer_detail_ok('[1, 2]');
  assert not aid_offer_detail_ok('{"coa": 9999999}');
  raise notice 'aid offer details ok';
end $$;
