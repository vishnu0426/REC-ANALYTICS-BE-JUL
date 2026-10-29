FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Single image, two roles. This CMD runs the API — the Celery worker is the
# same image with `command`/`args` overridden in its pod spec, e.g.:
#   celery -A app.tasks.celery_app worker --loglevel=info -Q gpu-heavy,cpu-io,priority-reprocess
# No --reload here: that's a dev-only watcher, wrong (and wasteful) in a
# built, immutable production image — k8s restarts the pod on a new image
# instead of a filesystem watch.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
