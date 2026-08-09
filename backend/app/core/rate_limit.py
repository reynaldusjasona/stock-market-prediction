from datetime import datetime, timedelta, timezone

# In-memory, per-process counter. This project has no rate limiting
# anywhere else to be consistent with (send-2fa/verify-2fa have none today -
# the 30s resend cooldown on the admin login page is a frontend-only timer,
# not enforced server-side) and no cache/queue infra (Redis etc.) is
# configured, so this is the simplest thing that's actually correct for how
# this app runs today (a single dev/uvicorn process).
#
# Known limitation: this resets on process restart and does not share state
# across multiple worker processes. If this is ever deployed behind more
# than one uvicorn/gunicorn worker, each worker keeps its own counter and
# the real effective limit becomes (max_count * worker_count). Fine for now;
# a DB-backed or Redis-backed counter would be the fix if that changes.
_request_log: dict[str, list[datetime]] = {}


def checkRateLimit(bucket: str, key: str, max_count: int, window_minutes: int) -> bool:
    """Record a call in `bucket` for `key` and return whether it's allowed.

    Returns False (and does not record the call) if `key` already has
    `max_count` calls within the trailing `window_minutes` for this bucket.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=window_minutes)
    log_key = f"{bucket}:{key}"
    recent = [t for t in _request_log.get(log_key, []) if t > cutoff]
    if len(recent) >= max_count:
        _request_log[log_key] = recent
        return False
    recent.append(now)
    _request_log[log_key] = recent
    return True
