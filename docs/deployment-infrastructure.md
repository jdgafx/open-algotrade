# Deployment Infrastructure and Scalability Plan

## Overview

A cloud-native, containerized infrastructure designed for high availability, auto-scaling, and rapid deployment of trading strategies with zero-downtime updates and comprehensive disaster recovery capabilities.

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CDN & Edge Security                                 │
│                   (CloudFlare, DDoS Protection, WAF)                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Load Balancer Tier                                   │
│                  (Application Load Balancer, Auto Scaling)                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  Trading    │ │ Risk Mgmt   │ │ Monitoring  │ │   API       │ │   Web UI    ││
│  │  Services   │ │  Services   │ │  Services   ││  Gateway    ││ Dashboard   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Data Storage Layer                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ PostgreSQL  │ │   Redis     │ │ InfluxDB    │ │ Elastic     │ │  S3/Object  ││
│  │ Cluster     │ │   Cluster   │ │   Cluster   ││Search Cluster││   Storage   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Multi-Region Setup                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │    US-EAST  │ │   US-WEST   │ │   EU-WEST   │ │   APAC      │ │ Disaster    ││
│  │   Primary   │ │   Backup    │ │   Region    ││   Region    ││  Recovery   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Kubernetes Infrastructure

### Cluster Configuration
```yaml
# k8s/cluster/cluster-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-config
  namespace: kairos
data:
  cluster.name: "kairos-trading"
  cluster.environment: "production"
  cluster.region: "us-east-1"
  cluster.version: "1.28"
  networking.pod-cidr: "10.244.0.0/16"
  networking.service-cidr: "10.96.0.0/12"
  addons.ingress: "nginx"
  addons.monitoring: "prometheus"
  addons.logging: "elasticsearch"
  addons.autoscaling: "cluster-autoscaler"

---
apiVersion: v1
kind: Namespace
metadata:
  name: kairos-trading
  labels:
    name: kairos-trading
    environment: production

---
apiVersion: v1
kind: Namespace
metadata:
  name: kairos-monitoring
  labels:
    name: kairos-monitoring
    environment: production

---
apiVersion: v1
kind: Namespace
metadata:
  name: kairos-logging
  labels:
    name: kairos-logging
    environment: production
```

### Trading Services Deployment
```yaml
# k8s/deployments/strategy-orchestrator.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: strategy-orchestrator
  namespace: kairos-trading
  labels:
    app: strategy-orchestrator
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: strategy-orchestrator
  template:
    metadata:
      labels:
        app: strategy-orchestrator
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: orchestrator
        image: kairos/strategy-orchestrator:latest
        ports:
        - containerPort: 8000
          name: http
          protocol: TCP
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: HYPERLIQUID_API_KEY
          valueFrom:
            secretKeyRef:
              name: exchange-credentials
              key: hyperliquid-api-key
        - name: HYPERLIQUID_SECRET
          valueFrom:
            secretKeyRef:
              name: exchange-credentials
              key: hyperliquid-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: config
        configMap:
          name: orchestrator-config
      - name: logs
        emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - strategy-orchestrator
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: strategy-orchestrator
  namespace: kairos-trading
  labels:
    app: strategy-orchestrator
spec:
  selector:
    app: strategy-orchestrator
  ports:
  - name: http
    port: 8000
    targetPort: 8000
    protocol: TCP
  type: ClusterIP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: strategy-orchestrator-hpa
  namespace: kairos-trading
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: strategy-orchestrator
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: active_strategies_per_pod
      target:
        type: AverageValue
        averageValue: "5"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Risk Management Service
```yaml
# k8s/deployments/risk-manager.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: risk-manager
  namespace: kairos-trading
  labels:
    app: risk-manager
    version: v1
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: risk-manager
  template:
    metadata:
      labels:
        app: risk-manager
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8001"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: risk-manager
        image: kairos/risk-manager:latest
        ports:
        - containerPort: 8001
          name: http
          protocol: TCP
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: CIRCUIT_BREAKER_ENABLED
          value: "true"
        - name: MAX_PORTFOLIO_RISK
          value: "0.25"
        - name: MAX_POSITION_SIZE
          value: "0.10"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: risk-manager-config
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - risk-manager
              topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: risk-manager
  namespace: kairos-trading
  labels:
    app: risk-manager
spec:
  selector:
    app: risk-manager
  ports:
  - name: http
    port: 8001
    targetPort: 8001
    protocol: TCP
  type: ClusterIP
```

### High-Performance Market Data Ingestion
```yaml
# k8s/deployments/market-data-ingestor.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: market-data-ingestor
  namespace: kairos-trading
  labels:
    app: market-data-ingestor
spec:
  serviceName: market-data-ingestor
  replicas: 3
  updateStrategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: market-data-ingestor
  template:
    metadata:
      labels:
        app: market-data-ingestor
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8002"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: ingestor
        image: kairos/market-data-ingestor:latest
        ports:
        - containerPort: 8002
          name: http
          protocol: TCP
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: INFLUXDB_URL
          valueFrom:
            secretKeyRef:
              name: influxdb-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: KAFKA_BROKERS
          value: "kafka-service:9092"
        - name: PROCESSING_WORKERS
          value: "4"
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8002
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: market-data-pvc
  volumeClaimTemplates:
  - metadata:
      name: market-data-pvc
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "ssd"
      resources:
        requests:
          storage: 100Gi

---
apiVersion: v1
kind: Service
metadata:
  name: market-data-ingestor
  namespace: kairos-trading
  labels:
    app: market-data-ingestor
spec:
  selector:
    app: market-data-ingestor
  ports:
  - name: http
    port: 8002
    targetPort: 8002
    protocol: TCP
  clusterIP: None
```

## Auto-Scaling Configuration

### Cluster Autoscaler
```yaml
# k8s/cluster/cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/kairos-trading
        - --balance-similar-node-groups
        - --skip-nodes-with-system-pods=false
        - --max-node-provision-time=300s
        - --ok-total-unready-count=3
        - --max-total-unready-percentage=10
        - --scale-down-unneeded-time=10m
        - --scale-down-unready-time=20m
        - --scale-down-delay-after-add=3m
        - --scale-down-delay-after-delete=1m
        - --max-graceful-termination-sec=600
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/kairos-trading
```

### Vertical Pod Autoscaler
```yaml
# k8s/autoscaling/vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: strategy-orchestrator-vpa
  namespace: kairos-trading
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: strategy-orchestrator
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: orchestrator
      maxAllowed:
        cpu: 2
        memory: 2Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
      controlledResources: ["cpu", "memory"]

---
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: risk-manager-vpa
  namespace: kairos-trading
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: risk-manager
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: risk-manager
      maxAllowed:
        cpu: 4
        memory: 4Gi
      minAllowed:
        cpu: 250m
        memory: 256Mi
      controlledResources: ["cpu", "memory"]
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: kairos

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [strategy-orchestrator, risk-manager, market-data-ingestor, api-gateway]
    steps:
    - uses: actions/checkout@v4

    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-test.txt

    - name: Run linting
      run: |
        flake8 services/${{ matrix.service }}/
        black --check services/${{ matrix.service }}/
        mypy services/${{ matrix.service }}/

    - name: Run unit tests
      run: |
        pytest services/${{ matrix.service }}/tests/ --cov=services/${{ matrix.service }} --cov-report=xml

    - name: Run integration tests
      run: |
        pytest tests/integration/ --timeout=300

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  build-and-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        service: [strategy-orchestrator, risk-manager, market-data-ingestor, api-gateway]
    steps:
    - uses: actions/checkout@v4

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: services/${{ matrix.service }}/
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name kairos-staging

    - name: Deploy to staging
      run: |
        helm upgrade --install kairos-staging ./helm/kairos \
          --namespace kairos-staging \
          --create-namespace \
          --set environment=staging \
          --set image.tag=main \
          --wait \
          --timeout=10m

    - name: Run smoke tests
      run: |
        kubectl wait --for=condition=ready pod -l app=strategy-orchestrator -n kairos-staging --timeout=300s
        python scripts/smoke_tests.py --environment=staging

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name kairos-production

    - name: Deploy to production (Blue-Green)
      run: |
        # Create new green deployment
        helm upgrade --install kairos-green ./helm/kairos \
          --namespace kairos-production \
          --set environment=production \
          --set deployment.color=green \
          --set image.tag=main \
          --wait \
          --timeout=10m

        # Run health checks
        python scripts/health_checks.py --deployment=green

        # Switch traffic to green
        kubectl patch service strategy-orchestrator -p '{"spec":{"selector":{"color":"green"}}}' -n kairos-production

        # Wait for cutover verification
        sleep 30

        # Verify production health
        python scripts/production_verification.py

        # Clean up blue deployment
        helm uninstall kairos-blue -n kairos-production || true

    - name: Post-deployment verification
      run: |
        python scripts/post_deployment_tests.py --environment=production
        kubectl get pods -n kairos-production
        kubectl get services -n kairos-production

    - name: Notify on deployment success
      uses: 8398a7/action-slack@v3
      with:
        status: success
        channel: '#deployments'
        text: '🚀 Production deployment successful!'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Helm Chart Structure
```yaml
# helm/kairos/Chart.yaml
apiVersion: v2
name: kairos
description: Kairos Algorithmic Trading Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - trading
  - algorithmic-trading
  - cryptocurrency
  - defi
home: https://github.com/kairos/algotrade
sources:
  - https://github.com/kairos/algotrade
maintainers:
  - name: Kairos Team
    email: team@kairos.com
dependencies:
  - name: postgresql
    version: 12.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  - name: influxdb
    version: 6.x.x
    repository: https://charts.influxdata.com/
    condition: influxdb.enabled
  - name: elasticsearch
    version: 19.x.x
    repository: https://helm.elastic.co
    condition: elasticsearch.enabled
  - name: prometheus
    version: 23.x.x
    repository: https://prometheus-community.github.io/helm-charts
    condition: monitoring.enabled
  - name: grafana
    version: 6.x.x
    repository: https://grafana.github.io/helm-charts
    condition: monitoring.enabled

# helm/kairos/values.yaml
environment: production
deployment:
  color: blue  # For blue-green deployments
  replicas:
    strategyOrchestrator: 3
    riskManager: 2
    marketDataIngestor: 3
    apiGateway: 2
    monitoringDashboard: 1

images:
  repository: ghcr.io/kairos
  tag: latest
  pullPolicy: IfNotPresent

resources:
  strategyOrchestrator:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  riskManager:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
  marketDataIngestor:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"

autoscaling:
  enabled: true
  strategyOrchestrator:
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  riskManager:
    minReplicas: 2
    maxReplicas: 5
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

database:
  postgresql:
    enabled: true
    auth:
      postgresPassword: "changeme"
      username: "kairos"
      password: "changeme"
      database: "kairos_prod"
    primary:
      persistence:
        enabled: true
        size: 100Gi
        storageClass: "ssd"
      resources:
        requests:
          memory: "2Gi"
          cpu: "1000m"
        limits:
          memory: "4Gi"
          cpu: "2000m"

  redis:
    enabled: true
    auth:
      enabled: true
      password: "changeme"
    master:
      persistence:
        enabled: true
        size: 20Gi
        storageClass: "ssd"
      resources:
        requests:
          memory: "1Gi"
          cpu: "500m"
        limits:
          memory: "2Gi"
          cpu: "1000m"

monitoring:
  enabled: true
  prometheus:
    enabled: true
    server:
      retention: "30d"
      storageSpec:
        volumeClaimTemplate:
          spec:
            storageClassName: "ssd"
            accessModes: ["ReadWriteOnce"]
            resources:
              requests:
                storage: 50Gi
  grafana:
    enabled: true
    adminPassword: "changeme"
    persistence:
      enabled: true
      size: 10Gi

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "1000"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
  tls:
    - hosts:
        - api.kairos.com
        - dashboard.kairos.com
      secretName: kairos-tls
  hosts:
    - host: api.kairos.com
      paths:
        - path: /
          pathType: Prefix
          service: api-gateway
    - host: dashboard.kairos.com
      paths:
        - path: /
          pathType: Prefix
          service: monitoring-dashboard
```

## Disaster Recovery Plan

### Multi-Region Setup
```yaml
# k8s/disaster-recovery/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: kairos-trading
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="kairos_backup_${TIMESTAMP}.sql"

              pg_dump $DATABASE_URL > /backup/${BACKUP_FILE}

              # Compress backup
              gzip /backup/${BACKUP_FILE}

              # Upload to S3
              aws s3 cp /backup/${BACKUP_FILE}.gz s3://kairos-backups/database/${BACKUP_FILE}.gz

              # Clean up old backups (keep last 30 days)
              aws s3 ls s3://kairos-backups/database/ | while read -r line; do
                createDate=`echo $line | awk '{print $1" "$2}'`
                createDate=`date -d"$createDate" +%s`
                olderThan=`date -d"30 days ago" +%s`
                if [[ $createDate -lt $olderThan ]]; then
                  fileName=`echo $line | awk '{print $4}'`
                  aws s3 rm s3://kairos-backups/database/$fileName
                fi
              done
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: access-key-id
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: secret-access-key
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
```

### Regional Failover
```yaml
# k8s/disaster-recovery/failover-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: regional-failover
  namespace: kairos-trading
spec:
  template:
    spec:
      containers:
      - name: failover
        image: kairos/disaster-recovery:latest
        command:
        - /bin/bash
        - -c
        - |
          # Check primary region health
          if ! python scripts/check_primary_health.py; then
            echo "Primary region unhealthy, initiating failover"

            # Promote secondary region
            python scripts/promote_secondary_region.py

            # Update DNS to point to secondary region
            python scripts/update_dns.py --region=secondary

            # Send notification
            python scripts/send_alert.py --message="Regional failover initiated"

            # Verify failover
            if python scripts/verify_failover.py; then
              echo "Failover successful"
            else
              echo "Failover failed, manual intervention required"
              python scripts/send_emergency_alert.py
            fi
          fi
        env:
        - name: PRIMARY_REGION
          value: "us-east-1"
        - name: SECONDARY_REGION
          value: "us-west-2"
        - name: DNS_ZONE_ID
          valueFrom:
            secretKeyRef:
              name: route53-credentials
              key: zone-id
      restartPolicy: OnFailure
```

## Performance Optimization

### Resource Monitoring and Optimization
```python
# scripts/performance_optimizer.py
import asyncio
import kubernetes
import psutil
import time
from datetime import datetime, timedelta

class PerformanceOptimizer:
    def __init__(self):
        kubernetes.config.load_incluster_config()
        self.v1 = kubernetes.client.CoreV1Api()
        self.apps_v1 = kubernetes.client.AppsV1Api()
        self.custom_api = kubernetes.client.CustomObjectsApi()

    async def optimize_cluster_resources(self):
        """Optimize cluster resource allocation"""
        while True:
            try:
                # Analyze current resource usage
                usage_metrics = await self.collect_resource_metrics()

                # Identify optimization opportunities
                optimizations = await self.analyze_usage_patterns(usage_metrics)

                # Apply optimizations
                for optimization in optimizations:
                    await self.apply_optimization(optimization)

                # Wait for next cycle
                await asyncio.sleep(300)  # 5 minutes

            except Exception as e:
                print(f"Error in optimization cycle: {e}")
                await asyncio.sleep(60)

    async def collect_resource_metrics(self) -> dict:
        """Collect resource usage metrics from all pods"""
        metrics = {
            'pods': [],
            'nodes': [],
            'cluster_summary': {}
        }

        # Get pod metrics
        pods = self.v1.list_pod_for_all_namespaces()
        for pod in pods.items:
            if pod.status.phase == 'Running':
                cpu_usage = await self.get_pod_cpu_usage(pod)
                memory_usage = await self.get_pod_memory_usage(pod)

                metrics['pods'].append({
                    'name': pod.metadata.name,
                    'namespace': pod.metadata.namespace,
                    'cpu_usage': cpu_usage,
                    'memory_usage': memory_usage,
                    'cpu_requests': self.get_resource_requests(pod, 'cpu'),
                    'memory_requests': self.get_resource_requests(pod, 'memory'),
                    'cpu_limits': self.get_resource_limits(pod, 'cpu'),
                    'memory_limits': self.get_resource_limits(pod, 'memory')
                })

        # Get node metrics
        nodes = self.v1.list_node()
        for node in nodes.items:
            metrics['nodes'].append({
                'name': node.metadata.name,
                'cpu_capacity': node.status.capacity.get('cpu'),
                'memory_capacity': node.status.capacity.get('memory'),
                'cpu_allocatable': node.status.allocatable.get('cpu'),
                'memory_allocatable': node.status.allocatable.get('memory'),
                'pods': len([p for p in pods.items if p.spec.node_name == node.metadata.name])
            })

        return metrics

    async def analyze_usage_patterns(self, metrics: dict) -> list:
        """Analyze usage patterns and identify optimization opportunities"""
        optimizations = []

        for pod in metrics['pods']:
            # Check for over-provisioned pods
            if pod['cpu_usage'] < 0.3 * pod['cpu_requests']:
                optimizations.append({
                    'type': 'downscale',
                    'target': pod['name'],
                    'namespace': pod['namespace'],
                    'resource': 'cpu',
                    'current_requests': pod['cpu_requests'],
                    'recommended_requests': max(pod['cpu_usage'] * 2, pod['cpu_usage'] + 0.1)
                })

            if pod['memory_usage'] < 0.3 * pod['memory_requests']:
                optimizations.append({
                    'type': 'downscale',
                    'target': pod['name'],
                    'namespace': pod['namespace'],
                    'resource': 'memory',
                    'current_requests': pod['memory_requests'],
                    'recommended_requests': max(pod['memory_usage'] * 2, pod['memory_usage'] + 100)
                })

            # Check for under-utilized pods that could be consolidated
            if pod['cpu_usage'] < 0.1 and pod['memory_usage'] < 0.1:
                optimizations.append({
                    'type': 'consolidate',
                    'target': pod['name'],
                    'namespace': pod['namespace'],
                    'reason': 'Extremely low utilization'
                })

        return optimizations

    async def apply_optimization(self, optimization: dict):
        """Apply optimization to deployment"""
        try:
            if optimization['type'] == 'downscale':
                await self.downscale_deployment(optimization)
            elif optimization['type'] == 'consolidate':
                await self.consolidate_deployment(optimization)

        except Exception as e:
            print(f"Failed to apply optimization: {e}")

    async def downscale_deployment(self, optimization: dict):
        """Downscale deployment resources"""
        # Get current deployment
        deployment = self.apps_v1.read_namespaced_deployment(
            optimization['target'], optimization['namespace']
        )

        # Update resource requests
        for container in deployment.spec.template.spec.containers:
            if optimization['resource'] == 'cpu':
                container.resources.requests['cpu'] = f"{optimization['recommended_requests']}m"
            elif optimization['resource'] == 'memory':
                container.resources.requests['memory'] = f"{optimization['recommended_requests']}Mi"

        # Apply update
        self.apps_v1.patch_namespaced_deployment(
            name=optimization['target'],
            namespace=optimization['namespace'],
            body=deployment
        )

        print(f"Downscaled {optimization['target']} {optimization['resource']} to {optimization['recommended_requests']}")

    async def consolidate_deployment(self, optimization: dict):
        """Consolidate underutilized deployment"""
        # Scale down to 0 replicas
        scale = kubernetes.client.V1Scale(
            metadata=kubernetes.client.V1ObjectMeta(
                name=optimization['target'],
                namespace=optimization['namespace']
            ),
            spec=kubernetes.client.V1ScaleSpec(
                replicas=0
            )
        )

        self.apps_v1.patch_namespaced_scale(
            name=optimization['target'],
            namespace=optimization['namespace'],
            body=scale
        )

        print(f"Consolidated {optimization['target']} - scaled to 0 replicas")
```

This comprehensive deployment infrastructure provides enterprise-grade scalability, reliability, and disaster recovery capabilities while maintaining the low-latency requirements essential for high-frequency trading operations.