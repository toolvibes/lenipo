{{- define "lenipo.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "lenipo.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "lenipo.selector" -}}
app.kubernetes.io/name: {{ .root.Chart.Name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .role }}
{{- end -}}

{{- define "lenipo.image" -}}
{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end -}}

{{- define "lenipo.secretName" -}}
{{ .Values.existingSecret | default (include "lenipo.fullname" .) }}
{{- end -}}

{{/* Environment shared by every role. */}}
{{- define "lenipo.env" -}}
- name: METRICS_PORT
  value: {{ .Values.metrics.port | quote }}
- name: SHUTDOWN_TIMEOUT_SECONDS
  value: {{ .Values.shutdown.timeoutSeconds | quote }}
{{- if .Values.publicUrl }}
- name: PUBLIC_URL
  value: {{ .Values.publicUrl | quote }}
{{- end }}
{{- range $name, $value := .Values.env }}
- name: {{ $name }}
  value: {{ $value | quote }}
{{- end }}
{{- end -}}

{{/* The pod spec of one role: .root is the chart context, .role the MODE. */}}
{{- define "lenipo.pod" -}}
{{- $root := .root -}}
metadata:
  labels:
    {{- include "lenipo.selector" . | nindent 4 }}
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: {{ $root.Values.metrics.port | quote }}
    checksum/secret: {{ toJson $root.Values.secrets | sha256sum }}
spec:
  {{- with $root.Values.imagePullSecrets }}
  imagePullSecrets: {{- toYaml . | nindent 4 }}
  {{- end }}
  securityContext: {{- toYaml $root.Values.podSecurityContext | nindent 4 }}
  terminationGracePeriodSeconds: {{ add $root.Values.shutdown.preStopSeconds $root.Values.shutdown.timeoutSeconds 10 }}
  containers:
    - name: {{ .role }}
      image: {{ include "lenipo.image" $root }}
      imagePullPolicy: {{ $root.Values.image.pullPolicy }}
      securityContext: {{- toYaml $root.Values.securityContext | nindent 8 }}
      env:
        - name: MODE
          value: {{ .role }}
        {{- include "lenipo.env" $root | nindent 8 }}
      envFrom:
        - secretRef:
            name: {{ include "lenipo.secretName" $root }}
      ports:
        {{- if eq .role "api" }}
        - { name: http, containerPort: 4000 }
        {{- end }}
        {{- if eq .role "collab" }}
        - { name: collab, containerPort: 4001 }
        {{- end }}
        - { name: metrics, containerPort: {{ $root.Values.metrics.port }} }
      {{- if eq .role "api" }}
      readinessProbe:
        httpGet: { path: /api/v1/health/ready, port: http }
        periodSeconds: 5
      livenessProbe:
        httpGet: { path: /api/v1/health/live, port: http }
        periodSeconds: 15
      startupProbe:
        httpGet: { path: /api/v1/health/live, port: http }
        periodSeconds: 5
        failureThreshold: 60
      {{- else if eq .role "collab" }}
      readinessProbe:
        tcpSocket: { port: collab }
        periodSeconds: 5
      livenessProbe:
        tcpSocket: { port: collab }
        periodSeconds: 15
      {{- else }}
      livenessProbe:
        httpGet: { path: /metrics, port: metrics }
        periodSeconds: 30
        initialDelaySeconds: 30
      {{- end }}
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "{{ $root.Values.shutdown.preStopSeconds }}"]
      resources: {{- toYaml (index $root.Values .role).resources | nindent 8 }}
      {{- if $root.Values.persistence.enabled }}
      volumeMounts:
        - name: files
          mountPath: {{ $root.Values.persistence.mountPath }}
      {{- end }}
  {{- if $root.Values.persistence.enabled }}
  volumes:
    - name: files
      persistentVolumeClaim:
        claimName: {{ required "persistence.existingClaim is required" $root.Values.persistence.existingClaim }}
  {{- end }}
  {{- with $root.Values.nodeSelector }}
  nodeSelector: {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with $root.Values.tolerations }}
  tolerations: {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with $root.Values.affinity }}
  affinity: {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end -}}
