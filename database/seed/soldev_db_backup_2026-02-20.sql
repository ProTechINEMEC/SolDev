--
-- PostgreSQL database dump
--

\restrict MdohZ2oLf4PdhdctOuXCugxBNYIX6Cfa1miwl8jOROHFhkwEKyokA5g7TeeLQYk

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: categoria_ticket; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.categoria_ticket AS ENUM (
    'hardware',
    'software',
    'red',
    'acceso',
    'otro',
    'soporte_general'
);


ALTER TYPE public.categoria_ticket OWNER TO soldev_user;

--
-- Name: estado_aprobacion; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.estado_aprobacion AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado',
    'reevaluacion'
);


ALTER TYPE public.estado_aprobacion OWNER TO soldev_user;

--
-- Name: estado_proyecto; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.estado_proyecto AS ENUM (
    'planificacion',
    'en_desarrollo',
    'pausado',
    'completado',
    'cancelado'
);


ALTER TYPE public.estado_proyecto OWNER TO soldev_user;

--
-- Name: estado_solicitud; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.estado_solicitud AS ENUM (
    'pendiente_evaluacion_nt',
    'descartado_nt',
    'pendiente_aprobacion_gerencia',
    'rechazado_gerencia',
    'aprobado',
    'en_desarrollo',
    'stand_by',
    'completado',
    'cancelado',
    'en_estudio',
    'pendiente_reevaluacion',
    'agendado',
    'transferido_ti',
    'resuelto',
    'no_realizado',
    'en_proceso',
    'pausado'
);


ALTER TYPE public.estado_solicitud OWNER TO soldev_user;

--
-- Name: estado_ticket; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.estado_ticket AS ENUM (
    'abierto',
    'en_proceso',
    'resuelto',
    'cerrado',
    'escalado_nt',
    'transferido_nt',
    'solucionado',
    'no_realizado'
);


ALTER TYPE public.estado_ticket OWNER TO soldev_user;

--
-- Name: nivel_prioridad; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.nivel_prioridad AS ENUM (
    'baja',
    'media',
    'alta',
    'critica'
);


ALTER TYPE public.nivel_prioridad OWNER TO soldev_user;

--
-- Name: rol_usuario; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.rol_usuario AS ENUM (
    'nuevas_tecnologias',
    'ti',
    'gerencia'
);


ALTER TYPE public.rol_usuario OWNER TO soldev_user;

--
-- Name: tipo_solicitud; Type: TYPE; Schema: public; Owner: soldev_user
--

CREATE TYPE public.tipo_solicitud AS ENUM (
    'proyecto_nuevo_interno',
    'proyecto_nuevo_externo',
    'actualizacion',
    'reporte_fallo',
    'cierre_servicio',
    'transferido_ti'
);


ALTER TYPE public.tipo_solicitud OWNER TO soldev_user;

--
-- Name: calcular_progreso_practico(integer); Type: FUNCTION; Schema: public; Owner: soldev_user
--

CREATE FUNCTION public.calcular_progreso_practico(p_solicitud_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_progreso NUMERIC;
BEGIN
    SELECT
        CASE
            WHEN SUM(ct.duracion_dias) = 0 THEN 0
            ELSE ROUND(SUM(ct.progreso * ct.duracion_dias)::NUMERIC / SUM(ct.duracion_dias)::NUMERIC)
        END
    INTO v_progreso
    FROM cronograma_tareas ct
    JOIN cronogramas c ON c.id = ct.cronograma_id
    WHERE c.solicitud_id = p_solicitud_id;

    RETURN COALESCE(v_progreso, 0)::INTEGER;
END;
$$;


ALTER FUNCTION public.calcular_progreso_practico(p_solicitud_id integer) OWNER TO soldev_user;

--
-- Name: calcular_progreso_teorico(integer); Type: FUNCTION; Schema: public; Owner: soldev_user
--

CREATE FUNCTION public.calcular_progreso_teorico(p_solicitud_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_fecha_inicio TIMESTAMP;
    v_dias_planificados INTEGER;
    v_dias_pausados INTEGER;
    v_dias_en_desarrollo INTEGER;
    v_progreso INTEGER;
BEGIN
    SELECT
        fecha_inicio_desarrollo,
        COALESCE(dias_pausados_total, 0),
        EXTRACT(DAY FROM (fecha_fin_programada - fecha_inicio_programada))::INTEGER
    INTO v_fecha_inicio, v_dias_pausados, v_dias_planificados
    FROM solicitudes
    WHERE id = p_solicitud_id;

    IF v_fecha_inicio IS NULL OR v_dias_planificados IS NULL OR v_dias_planificados = 0 THEN
        RETURN 0;
    END IF;

    -- Calculate working days in development (excluding paused days)
    v_dias_en_desarrollo := GREATEST(0, EXTRACT(DAY FROM (NOW() - v_fecha_inicio))::INTEGER - v_dias_pausados);

    -- Calculate percentage (max 100)
    v_progreso := LEAST(100, (v_dias_en_desarrollo * 100) / v_dias_planificados);

    RETURN v_progreso;
END;
$$;


ALTER FUNCTION public.calcular_progreso_teorico(p_solicitud_id integer) OWNER TO soldev_user;

--
-- Name: get_pausa_activa(integer); Type: FUNCTION; Schema: public; Owner: soldev_user
--

CREATE FUNCTION public.get_pausa_activa(p_solicitud_id integer) RETURNS TABLE(id integer, fecha_inicio timestamp without time zone, motivo text, dias_transcurridos integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.id,
        pp.fecha_inicio,
        pp.motivo,
        EXTRACT(DAY FROM (NOW() - pp.fecha_inicio))::INTEGER as dias_transcurridos
    FROM proyecto_pausas pp
    WHERE pp.solicitud_id = p_solicitud_id
    AND pp.fecha_fin IS NULL
    LIMIT 1;
END;
$$;


ALTER FUNCTION public.get_pausa_activa(p_solicitud_id integer) OWNER TO soldev_user;

--
-- Name: update_opciones_timestamp(); Type: FUNCTION; Schema: public; Owner: soldev_user
--

CREATE FUNCTION public.update_opciones_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_opciones_timestamp() OWNER TO soldev_user;

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: soldev_user
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp() OWNER TO soldev_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aprobaciones; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.aprobaciones (
    id integer NOT NULL,
    solicitud_id integer,
    aprobador_id integer,
    estado public.estado_aprobacion DEFAULT 'pendiente'::public.estado_aprobacion,
    comentario text,
    fecha_decision timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now(),
    comentarios text
);


ALTER TABLE public.aprobaciones OWNER TO soldev_user;

--
-- Name: aprobaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.aprobaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.aprobaciones_id_seq OWNER TO soldev_user;

--
-- Name: aprobaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.aprobaciones_id_seq OWNED BY public.aprobaciones.id;


--
-- Name: archivos; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.archivos (
    id integer NOT NULL,
    entidad_tipo character varying(20) NOT NULL,
    entidad_id integer NOT NULL,
    nombre_original character varying(255) NOT NULL,
    nombre_almacenado character varying(255) NOT NULL,
    mime_type character varying(100),
    tamano integer,
    ruta text NOT NULL,
    subido_por integer,
    creado_en timestamp without time zone DEFAULT now(),
    origen character varying(50) DEFAULT 'creacion'::character varying,
    comentario_id integer,
    respuesta_numero character varying(3),
    CONSTRAINT archivos_entidad_tipo_check CHECK (((entidad_tipo)::text = ANY ((ARRAY['solicitud'::character varying, 'proyecto'::character varying, 'ticket'::character varying, 'articulo'::character varying])::text[])))
);


ALTER TABLE public.archivos OWNER TO soldev_user;

--
-- Name: COLUMN archivos.origen; Type: COMMENT; Schema: public; Owner: soldev_user
--

COMMENT ON COLUMN public.archivos.origen IS 'Origin of upload: creacion, comentario, resolucion, actualizacion';


--
-- Name: archivos_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.archivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.archivos_id_seq OWNER TO soldev_user;

--
-- Name: archivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.archivos_id_seq OWNED BY public.archivos.id;


--
-- Name: codigos_verificacion; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.codigos_verificacion (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    nombre character varying(100) NOT NULL,
    codigo character varying(6) NOT NULL,
    usado boolean DEFAULT false,
    intentos integer DEFAULT 0,
    expira_en timestamp without time zone NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.codigos_verificacion OWNER TO soldev_user;

--
-- Name: codigos_verificacion_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.codigos_verificacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.codigos_verificacion_id_seq OWNER TO soldev_user;

--
-- Name: codigos_verificacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.codigos_verificacion_id_seq OWNED BY public.codigos_verificacion.id;


--
-- Name: comentarios; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.comentarios (
    id integer NOT NULL,
    entidad_tipo character varying(20) NOT NULL,
    entidad_id integer NOT NULL,
    usuario_id integer,
    contenido text NOT NULL,
    tipo character varying(20) DEFAULT 'comentario'::character varying,
    interno boolean DEFAULT false,
    creado_en timestamp without time zone DEFAULT now(),
    autor_externo character varying(255),
    CONSTRAINT comentarios_entidad_tipo_check CHECK (((entidad_tipo)::text = ANY ((ARRAY['solicitud'::character varying, 'proyecto'::character varying, 'ticket'::character varying])::text[])))
);


ALTER TABLE public.comentarios OWNER TO soldev_user;

--
-- Name: comentarios_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.comentarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.comentarios_id_seq OWNER TO soldev_user;

--
-- Name: comentarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.comentarios_id_seq OWNED BY public.comentarios.id;


--
-- Name: comentarios_reevaluacion; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.comentarios_reevaluacion (
    id integer NOT NULL,
    solicitud_id integer,
    evaluacion_id integer,
    gerente_id integer,
    tipo character varying(20) NOT NULL,
    contenido text NOT NULL,
    areas_revisar jsonb DEFAULT '[]'::jsonb,
    leido_por_nt boolean DEFAULT false,
    leido_en timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.comentarios_reevaluacion OWNER TO soldev_user;

--
-- Name: comentarios_reevaluacion_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.comentarios_reevaluacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.comentarios_reevaluacion_id_seq OWNER TO soldev_user;

--
-- Name: comentarios_reevaluacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.comentarios_reevaluacion_id_seq OWNED BY public.comentarios_reevaluacion.id;


--
-- Name: conocimiento_articulos; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.conocimiento_articulos (
    id integer NOT NULL,
    titulo character varying(200) NOT NULL,
    slug character varying(200) NOT NULL,
    resumen text,
    contenido text NOT NULL,
    categoria_id integer,
    autor_id integer,
    etiquetas text[] DEFAULT '{}'::text[],
    publicado boolean DEFAULT false,
    vistas integer DEFAULT 0,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.conocimiento_articulos OWNER TO soldev_user;

--
-- Name: conocimiento_articulos_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.conocimiento_articulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.conocimiento_articulos_id_seq OWNER TO soldev_user;

--
-- Name: conocimiento_articulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.conocimiento_articulos_id_seq OWNED BY public.conocimiento_articulos.id;


--
-- Name: conocimiento_categorias; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.conocimiento_categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    orden integer DEFAULT 0,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.conocimiento_categorias OWNER TO soldev_user;

--
-- Name: conocimiento_categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.conocimiento_categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.conocimiento_categorias_id_seq OWNER TO soldev_user;

--
-- Name: conocimiento_categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.conocimiento_categorias_id_seq OWNED BY public.conocimiento_categorias.id;


--
-- Name: cronograma_tareas; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.cronograma_tareas (
    id integer NOT NULL,
    cronograma_id integer,
    titulo character varying(200) NOT NULL,
    descripcion text,
    fecha_inicio date,
    fecha_fin date,
    duracion_dias integer,
    dependencia_ids integer[] DEFAULT '{}'::integer[],
    orden integer DEFAULT 0,
    color character varying(7) DEFAULT '#1890ff'::character varying,
    progreso integer DEFAULT 0,
    creado_en timestamp without time zone DEFAULT now(),
    nombre character varying(200),
    duracion integer,
    dependencias jsonb DEFAULT '[]'::jsonb,
    fase character varying(50),
    asignado_id integer,
    asignados_ids jsonb DEFAULT '[]'::jsonb,
    es_emergente boolean DEFAULT false,
    completado boolean DEFAULT false,
    CONSTRAINT cronograma_tareas_progreso_check CHECK (((progreso >= 0) AND (progreso <= 100)))
);


ALTER TABLE public.cronograma_tareas OWNER TO soldev_user;

--
-- Name: cronograma_tareas_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.cronograma_tareas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cronograma_tareas_id_seq OWNER TO soldev_user;

--
-- Name: cronograma_tareas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.cronograma_tareas_id_seq OWNED BY public.cronograma_tareas.id;


--
-- Name: cronogramas; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.cronogramas (
    id integer NOT NULL,
    evaluacion_id integer,
    solicitud_id integer,
    plantilla_origen character varying(100),
    fecha_inicio_propuesta date,
    fecha_fin_propuesta date,
    duracion_dias_habiles integer,
    datos jsonb DEFAULT '{}'::jsonb,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    nombre character varying(200),
    fecha_inicio date,
    fecha_fin date,
    equipo_ids jsonb DEFAULT '[]'::jsonb,
    fases jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.cronogramas OWNER TO soldev_user;

--
-- Name: cronogramas_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.cronogramas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cronogramas_id_seq OWNER TO soldev_user;

--
-- Name: cronogramas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.cronogramas_id_seq OWNED BY public.cronogramas.id;


--
-- Name: estimaciones_costo; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.estimaciones_costo (
    id integer NOT NULL,
    evaluacion_id integer,
    desarrollo_interno_horas numeric(10,2) DEFAULT 0,
    tarifa_hora numeric(12,2) DEFAULT 0,
    infraestructura_old numeric(12,2) DEFAULT 0,
    servicios_externos_old numeric(12,2) DEFAULT 0,
    contingencia_porcentaje numeric(5,2) DEFAULT 10,
    total_estimado numeric(14,2),
    desglose jsonb DEFAULT '{}'::jsonb,
    notas text,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    desarrollo_interno jsonb DEFAULT '[]'::jsonb,
    subtotal_desarrollo numeric(14,2) DEFAULT 0,
    subtotal_infraestructura numeric(14,2) DEFAULT 0,
    subtotal_externos numeric(14,2) DEFAULT 0,
    subtotal numeric(14,2) DEFAULT 0,
    contingencia numeric(14,2) DEFAULT 0,
    total numeric(14,2) DEFAULT 0,
    infraestructura jsonb DEFAULT '[]'::jsonb,
    servicios_externos jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.estimaciones_costo OWNER TO soldev_user;

--
-- Name: estimaciones_costo_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.estimaciones_costo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.estimaciones_costo_id_seq OWNER TO soldev_user;

--
-- Name: estimaciones_costo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.estimaciones_costo_id_seq OWNED BY public.estimaciones_costo.id;


--
-- Name: evaluacion_asignaciones; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.evaluacion_asignaciones (
    id integer NOT NULL,
    evaluacion_id integer,
    usuario_id integer,
    rol character varying(50) NOT NULL,
    es_lider boolean DEFAULT false,
    horas_estimadas integer,
    fecha_asignacion timestamp without time zone DEFAULT now()
);


ALTER TABLE public.evaluacion_asignaciones OWNER TO soldev_user;

--
-- Name: evaluacion_asignaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.evaluacion_asignaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.evaluacion_asignaciones_id_seq OWNER TO soldev_user;

--
-- Name: evaluacion_asignaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.evaluacion_asignaciones_id_seq OWNED BY public.evaluacion_asignaciones.id;


--
-- Name: evaluaciones_nt; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.evaluaciones_nt (
    id integer NOT NULL,
    solicitud_id integer,
    evaluador_id integer,
    resumen_ejecutivo text,
    recomendacion character varying(20),
    justificacion_recomendacion text,
    datos_adicionales jsonb DEFAULT '{}'::jsonb,
    estado character varying(20) DEFAULT 'borrador'::character varying,
    enviado_en timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    riesgos_identificados jsonb DEFAULT '[]'::jsonb,
    notas_adicionales text,
    fecha_envio timestamp without time zone,
    fecha_inicio_posible date,
    lider_id integer
);


ALTER TABLE public.evaluaciones_nt OWNER TO soldev_user;

--
-- Name: evaluaciones_nt_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.evaluaciones_nt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.evaluaciones_nt_id_seq OWNER TO soldev_user;

--
-- Name: evaluaciones_nt_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.evaluaciones_nt_id_seq OWNED BY public.evaluaciones_nt.id;


--
-- Name: festivos_colombia; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.festivos_colombia (
    id integer NOT NULL,
    fecha date NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(50) NOT NULL,
    ano integer NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.festivos_colombia OWNER TO soldev_user;

--
-- Name: festivos_colombia_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.festivos_colombia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.festivos_colombia_id_seq OWNER TO soldev_user;

--
-- Name: festivos_colombia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.festivos_colombia_id_seq OWNED BY public.festivos_colombia.id;


--
-- Name: historial_cambios; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.historial_cambios (
    id integer NOT NULL,
    entidad_tipo character varying(20) NOT NULL,
    entidad_id integer NOT NULL,
    accion character varying(50) NOT NULL,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    usuario_id integer,
    ip_address inet,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.historial_cambios OWNER TO soldev_user;

--
-- Name: historial_cambios_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.historial_cambios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.historial_cambios_id_seq OWNER TO soldev_user;

--
-- Name: historial_cambios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.historial_cambios_id_seq OWNED BY public.historial_cambios.id;


--
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.notificaciones (
    id integer NOT NULL,
    usuario_id integer,
    tipo character varying(50) NOT NULL,
    titulo character varying(200) NOT NULL,
    mensaje text,
    datos jsonb DEFAULT '{}'::jsonb,
    leida boolean DEFAULT false,
    leida_en timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now(),
    subtipo character varying(50)
);


ALTER TABLE public.notificaciones OWNER TO soldev_user;

--
-- Name: notificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.notificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notificaciones_id_seq OWNER TO soldev_user;

--
-- Name: notificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.notificaciones_id_seq OWNED BY public.notificaciones.id;


--
-- Name: opciones_formulario; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.opciones_formulario (
    id integer NOT NULL,
    categoria character varying(50) NOT NULL,
    valor character varying(100) NOT NULL,
    etiqueta character varying(200) NOT NULL,
    padre_id integer,
    orden integer DEFAULT 0,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.opciones_formulario OWNER TO soldev_user;

--
-- Name: opciones_formulario_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.opciones_formulario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.opciones_formulario_id_seq OWNER TO soldev_user;

--
-- Name: opciones_formulario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.opciones_formulario_id_seq OWNED BY public.opciones_formulario.id;


--
-- Name: proyecto_miembros; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.proyecto_miembros (
    id integer NOT NULL,
    proyecto_id integer,
    usuario_id integer,
    rol_proyecto character varying(50) DEFAULT 'miembro'::character varying,
    asignado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proyecto_miembros OWNER TO soldev_user;

--
-- Name: proyecto_miembros_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.proyecto_miembros_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proyecto_miembros_id_seq OWNER TO soldev_user;

--
-- Name: proyecto_miembros_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.proyecto_miembros_id_seq OWNED BY public.proyecto_miembros.id;


--
-- Name: proyecto_pausas; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.proyecto_pausas (
    id integer NOT NULL,
    solicitud_id integer NOT NULL,
    fecha_inicio timestamp without time zone DEFAULT now() NOT NULL,
    fecha_fin timestamp without time zone,
    motivo text NOT NULL,
    dias_pausados integer,
    creado_por integer NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proyecto_pausas OWNER TO soldev_user;

--
-- Name: proyecto_pausas_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.proyecto_pausas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proyecto_pausas_id_seq OWNER TO soldev_user;

--
-- Name: proyecto_pausas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.proyecto_pausas_id_seq OWNED BY public.proyecto_pausas.id;


--
-- Name: proyecto_tareas; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.proyecto_tareas (
    id integer NOT NULL,
    proyecto_id integer,
    titulo character varying(200) NOT NULL,
    descripcion text,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    progreso integer DEFAULT 0,
    completada boolean DEFAULT false,
    asignado_id integer,
    color character varying(7) DEFAULT '#1890ff'::character varying,
    orden integer DEFAULT 0,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    CONSTRAINT proyecto_tareas_progreso_check CHECK (((progreso >= 0) AND (progreso <= 100)))
);


ALTER TABLE public.proyecto_tareas OWNER TO soldev_user;

--
-- Name: proyecto_tareas_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.proyecto_tareas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proyecto_tareas_id_seq OWNER TO soldev_user;

--
-- Name: proyecto_tareas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.proyecto_tareas_id_seq OWNED BY public.proyecto_tareas.id;


--
-- Name: proyectos; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.proyectos (
    id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    solicitud_id integer,
    titulo character varying(200) NOT NULL,
    descripcion text,
    estado public.estado_proyecto DEFAULT 'planificacion'::public.estado_proyecto,
    fecha_inicio_estimada date,
    fecha_fin_estimada date,
    fecha_inicio_real date,
    fecha_fin_real date,
    presupuesto_estimado numeric(12,2),
    presupuesto_real numeric(12,2),
    responsable_id integer,
    datos_proyecto jsonb DEFAULT '{}'::jsonb,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.proyectos OWNER TO soldev_user;

--
-- Name: proyectos_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.proyectos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proyectos_id_seq OWNER TO soldev_user;

--
-- Name: proyectos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.proyectos_id_seq OWNED BY public.proyectos.id;


--
-- Name: reportes_semanales; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.reportes_semanales (
    id integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    datos jsonb NOT NULL,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.reportes_semanales OWNER TO soldev_user;

--
-- Name: reportes_semanales_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.reportes_semanales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reportes_semanales_id_seq OWNER TO soldev_user;

--
-- Name: reportes_semanales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.reportes_semanales_id_seq OWNED BY public.reportes_semanales.id;


--
-- Name: respuestas_pendientes; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.respuestas_pendientes (
    id integer NOT NULL,
    token character varying(64) NOT NULL,
    comentario_id integer,
    entidad_tipo character varying(20) NOT NULL,
    entidad_id integer NOT NULL,
    email_destino character varying(255) NOT NULL,
    usuario_pregunta_id integer,
    creado_en timestamp without time zone DEFAULT now(),
    expira_en timestamp without time zone NOT NULL,
    usado boolean DEFAULT false
);


ALTER TABLE public.respuestas_pendientes OWNER TO soldev_user;

--
-- Name: respuestas_pendientes_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.respuestas_pendientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.respuestas_pendientes_id_seq OWNER TO soldev_user;

--
-- Name: respuestas_pendientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.respuestas_pendientes_id_seq OWNED BY public.respuestas_pendientes.id;


--
-- Name: sesiones; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.sesiones (
    id integer NOT NULL,
    usuario_id integer,
    token text NOT NULL,
    expira_en timestamp without time zone NOT NULL,
    activa boolean DEFAULT true,
    ip_address inet,
    user_agent text,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sesiones OWNER TO soldev_user;

--
-- Name: sesiones_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.sesiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sesiones_id_seq OWNER TO soldev_user;

--
-- Name: sesiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.sesiones_id_seq OWNED BY public.sesiones.id;


--
-- Name: sesiones_solicitante; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.sesiones_solicitante (
    id integer NOT NULL,
    solicitante_id integer,
    token text NOT NULL,
    expira_en timestamp without time zone NOT NULL,
    activa boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.sesiones_solicitante OWNER TO soldev_user;

--
-- Name: sesiones_solicitante_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.sesiones_solicitante_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sesiones_solicitante_id_seq OWNER TO soldev_user;

--
-- Name: sesiones_solicitante_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.sesiones_solicitante_id_seq OWNED BY public.sesiones_solicitante.id;


--
-- Name: solicitantes; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.solicitantes (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    nombre character varying(100) NOT NULL,
    verificado boolean DEFAULT false,
    ultima_verificacion timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.solicitantes OWNER TO soldev_user;

--
-- Name: solicitantes_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.solicitantes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.solicitantes_id_seq OWNER TO soldev_user;

--
-- Name: solicitantes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.solicitantes_id_seq OWNED BY public.solicitantes.id;


--
-- Name: solicitudes; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.solicitudes (
    id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    tipo public.tipo_solicitud NOT NULL,
    estado public.estado_solicitud DEFAULT 'pendiente_evaluacion_nt'::public.estado_solicitud,
    prioridad public.nivel_prioridad DEFAULT 'media'::public.nivel_prioridad,
    titulo character varying(200) NOT NULL,
    solicitante_id integer,
    usuario_creador_id integer,
    evaluador_id integer,
    datos_solicitante jsonb DEFAULT '{}'::jsonb,
    datos_patrocinador jsonb DEFAULT '{}'::jsonb,
    datos_stakeholders jsonb DEFAULT '[]'::jsonb,
    descripcion_problema jsonb DEFAULT '{}'::jsonb,
    necesidad_urgencia jsonb DEFAULT '{}'::jsonb,
    solucion_propuesta jsonb DEFAULT '{}'::jsonb,
    beneficios jsonb DEFAULT '{}'::jsonb,
    kpis jsonb DEFAULT '[]'::jsonb,
    declaracion jsonb DEFAULT '{}'::jsonb,
    motivo_rechazo text,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    fecha_inicio_agendada date,
    fecha_fin_estimada date,
    reevaluaciones_count integer DEFAULT 0,
    transferido_a_ticket_id integer,
    origen_ticket_id integer,
    resolucion text,
    fecha_resolucion timestamp without time zone,
    fecha_inicio_programada date,
    fecha_fin_programada date,
    proyecto_referencia jsonb DEFAULT '{}'::jsonb,
    fecha_inicio_desarrollo timestamp without time zone,
    dias_pausados_total integer DEFAULT 0,
    motivo_cancelacion text,
    cancelado_en timestamp without time zone,
    cancelado_por integer
);


ALTER TABLE public.solicitudes OWNER TO soldev_user;

--
-- Name: solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.solicitudes_id_seq OWNER TO soldev_user;

--
-- Name: solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.solicitudes_id_seq OWNED BY public.solicitudes.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    titulo character varying(200) NOT NULL,
    descripcion text NOT NULL,
    categoria public.categoria_ticket NOT NULL,
    estado public.estado_ticket DEFAULT 'abierto'::public.estado_ticket,
    prioridad public.nivel_prioridad DEFAULT 'media'::public.nivel_prioridad,
    solicitante_id integer,
    usuario_creador_id integer,
    asignado_id integer,
    datos_solicitante jsonb DEFAULT '{}'::jsonb,
    resolucion text,
    fecha_resolucion timestamp without time zone,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    transferido_a_solicitud_id integer
);


ALTER TABLE public.tickets OWNER TO soldev_user;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tickets_id_seq OWNER TO soldev_user;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: transferencias; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.transferencias (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    origen_tipo character varying(20) NOT NULL,
    origen_id integer NOT NULL,
    origen_codigo character varying(20) NOT NULL,
    destino_tipo character varying(20) NOT NULL,
    destino_id integer NOT NULL,
    destino_codigo character varying(20) NOT NULL,
    motivo text,
    usuario_id integer,
    creado_en timestamp without time zone DEFAULT now()
);


ALTER TABLE public.transferencias OWNER TO soldev_user;

--
-- Name: transferencias_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.transferencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transferencias_id_seq OWNER TO soldev_user;

--
-- Name: transferencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.transferencias_id_seq OWNED BY public.transferencias.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: soldev_user
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    nombre character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol public.rol_usuario NOT NULL,
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT now(),
    actualizado_en timestamp without time zone DEFAULT now(),
    ultimo_acceso timestamp without time zone
);


ALTER TABLE public.usuarios OWNER TO soldev_user;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: soldev_user
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.usuarios_id_seq OWNER TO soldev_user;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: soldev_user
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: vista_proyectos_progreso; Type: VIEW; Schema: public; Owner: soldev_user
--

CREATE VIEW public.vista_proyectos_progreso AS
 SELECT s.id,
    s.codigo,
    s.titulo,
    s.estado,
    s.prioridad,
    s.fecha_inicio_programada,
    s.fecha_fin_programada,
    s.fecha_inicio_desarrollo,
    s.dias_pausados_total,
    e.lider_id,
    u.nombre AS lider_nombre,
    public.calcular_progreso_teorico(s.id) AS progreso_teorico,
    public.calcular_progreso_practico(s.id) AS progreso_practico,
    ( SELECT count(*) AS count
           FROM (public.cronograma_tareas ct
             JOIN public.cronogramas c ON ((c.id = ct.cronograma_id)))
          WHERE (c.solicitud_id = s.id)) AS total_tareas,
    ( SELECT count(*) AS count
           FROM (public.cronograma_tareas ct
             JOIN public.cronogramas c ON ((c.id = ct.cronograma_id)))
          WHERE ((c.solicitud_id = s.id) AND (ct.completado = true))) AS tareas_completadas,
    ( SELECT count(*) AS count
           FROM (public.cronograma_tareas ct
             JOIN public.cronogramas c ON ((c.id = ct.cronograma_id)))
          WHERE ((c.solicitud_id = s.id) AND (ct.es_emergente = true))) AS tareas_emergentes,
    ( SELECT pp.motivo
           FROM public.proyecto_pausas pp
          WHERE ((pp.solicitud_id = s.id) AND (pp.fecha_fin IS NULL))
         LIMIT 1) AS motivo_pausa_actual,
    ( SELECT count(*) AS count
           FROM public.proyecto_pausas pp
          WHERE (pp.solicitud_id = s.id)) AS total_pausas
   FROM ((public.solicitudes s
     LEFT JOIN public.evaluaciones_nt e ON (((e.solicitud_id = s.id) AND ((e.estado)::text = 'enviado'::text))))
     LEFT JOIN public.usuarios u ON ((e.lider_id = u.id)))
  WHERE ((s.tipo = ANY (ARRAY['proyecto_nuevo_interno'::public.tipo_solicitud, 'proyecto_nuevo_externo'::public.tipo_solicitud, 'actualizacion'::public.tipo_solicitud])) AND (s.estado = ANY (ARRAY['agendado'::public.estado_solicitud, 'en_desarrollo'::public.estado_solicitud, 'pausado'::public.estado_solicitud, 'completado'::public.estado_solicitud, 'cancelado'::public.estado_solicitud])));


ALTER TABLE public.vista_proyectos_progreso OWNER TO soldev_user;

--
-- Name: VIEW vista_proyectos_progreso; Type: COMMENT; Schema: public; Owner: soldev_user
--

COMMENT ON VIEW public.vista_proyectos_progreso IS 'Vista consolidada de proyectos con progreso teórico y práctico';


--
-- Name: aprobaciones id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.aprobaciones ALTER COLUMN id SET DEFAULT nextval('public.aprobaciones_id_seq'::regclass);


--
-- Name: archivos id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.archivos ALTER COLUMN id SET DEFAULT nextval('public.archivos_id_seq'::regclass);


--
-- Name: codigos_verificacion id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.codigos_verificacion ALTER COLUMN id SET DEFAULT nextval('public.codigos_verificacion_id_seq'::regclass);


--
-- Name: comentarios id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios ALTER COLUMN id SET DEFAULT nextval('public.comentarios_id_seq'::regclass);


--
-- Name: comentarios_reevaluacion id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios_reevaluacion ALTER COLUMN id SET DEFAULT nextval('public.comentarios_reevaluacion_id_seq'::regclass);


--
-- Name: conocimiento_articulos id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_articulos ALTER COLUMN id SET DEFAULT nextval('public.conocimiento_articulos_id_seq'::regclass);


--
-- Name: conocimiento_categorias id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_categorias ALTER COLUMN id SET DEFAULT nextval('public.conocimiento_categorias_id_seq'::regclass);


--
-- Name: cronograma_tareas id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronograma_tareas ALTER COLUMN id SET DEFAULT nextval('public.cronograma_tareas_id_seq'::regclass);


--
-- Name: cronogramas id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronogramas ALTER COLUMN id SET DEFAULT nextval('public.cronogramas_id_seq'::regclass);


--
-- Name: estimaciones_costo id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.estimaciones_costo ALTER COLUMN id SET DEFAULT nextval('public.estimaciones_costo_id_seq'::regclass);


--
-- Name: evaluacion_asignaciones id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluacion_asignaciones ALTER COLUMN id SET DEFAULT nextval('public.evaluacion_asignaciones_id_seq'::regclass);


--
-- Name: evaluaciones_nt id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluaciones_nt ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_nt_id_seq'::regclass);


--
-- Name: festivos_colombia id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.festivos_colombia ALTER COLUMN id SET DEFAULT nextval('public.festivos_colombia_id_seq'::regclass);


--
-- Name: historial_cambios id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.historial_cambios ALTER COLUMN id SET DEFAULT nextval('public.historial_cambios_id_seq'::regclass);


--
-- Name: notificaciones id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id SET DEFAULT nextval('public.notificaciones_id_seq'::regclass);


--
-- Name: opciones_formulario id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.opciones_formulario ALTER COLUMN id SET DEFAULT nextval('public.opciones_formulario_id_seq'::regclass);


--
-- Name: proyecto_miembros id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_miembros ALTER COLUMN id SET DEFAULT nextval('public.proyecto_miembros_id_seq'::regclass);


--
-- Name: proyecto_pausas id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_pausas ALTER COLUMN id SET DEFAULT nextval('public.proyecto_pausas_id_seq'::regclass);


--
-- Name: proyecto_tareas id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_tareas ALTER COLUMN id SET DEFAULT nextval('public.proyecto_tareas_id_seq'::regclass);


--
-- Name: proyectos id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyectos ALTER COLUMN id SET DEFAULT nextval('public.proyectos_id_seq'::regclass);


--
-- Name: reportes_semanales id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.reportes_semanales ALTER COLUMN id SET DEFAULT nextval('public.reportes_semanales_id_seq'::regclass);


--
-- Name: respuestas_pendientes id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.respuestas_pendientes ALTER COLUMN id SET DEFAULT nextval('public.respuestas_pendientes_id_seq'::regclass);


--
-- Name: sesiones id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones ALTER COLUMN id SET DEFAULT nextval('public.sesiones_id_seq'::regclass);


--
-- Name: sesiones_solicitante id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones_solicitante ALTER COLUMN id SET DEFAULT nextval('public.sesiones_solicitante_id_seq'::regclass);


--
-- Name: solicitantes id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitantes ALTER COLUMN id SET DEFAULT nextval('public.solicitantes_id_seq'::regclass);


--
-- Name: solicitudes id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: transferencias id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.transferencias ALTER COLUMN id SET DEFAULT nextval('public.transferencias_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: aprobaciones; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.aprobaciones (id, solicitud_id, aprobador_id, estado, comentario, fecha_decision, creado_en, comentarios) FROM stdin;
1	1	6	aprobado	\N	\N	2026-02-16 03:41:47.213228	Proyecto aprobado. Iniciar según cronograma propuesto.
\.


--
-- Data for Name: archivos; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.archivos (id, entidad_tipo, entidad_id, nombre_original, nombre_almacenado, mime_type, tamano, ruta, subido_por, creado_en, origen, comentario_id, respuesta_numero) FROM stdin;
1	ticket	27	test_upload.pdf	1771560118443-9610e1f66f69cb04.pdf	application/pdf	471	/uploads/1771560118443-9610e1f66f69cb04.pdf	\N	2026-02-20 04:01:58.451388	creacion	\N	\N
2	ticket	27	test_image.png	1771560118443-112e493a8b2e3265.png	image/png	70	/uploads/1771560118443-112e493a8b2e3265.png	\N	2026-02-20 04:01:58.476511	creacion	\N	\N
3	solicitud	24	test_upload.pdf	1771560207833-603e6333bf1ca527.pdf	application/pdf	471	/uploads/1771560207833-603e6333bf1ca527.pdf	\N	2026-02-20 04:03:27.835502	creacion	\N	\N
4	solicitud	26	test_upload.pdf	1771560603088-69c63b6fe6b97734.pdf	application/pdf	471	/uploads/1771560603088-69c63b6fe6b97734.pdf	\N	2026-02-20 04:10:03.091958	creacion	\N	\N
5	solicitud	26	test_image.png	1771560603089-52d2094c0220af6c.png	image/png	70	/uploads/1771560603089-52d2094c0220af6c.png	\N	2026-02-20 04:10:03.096601	creacion	\N	\N
6	solicitud	27	Anticipo repuestos Saturn 4.pdf	1771562067147-ae6c86a662ba945e.pdf	application/pdf	179152	/uploads/1771562067147-ae6c86a662ba945e.pdf	\N	2026-02-20 04:34:27.193565	creacion	\N	\N
7	solicitud	27	Anticipo repuestos Saturn 4.pdf	1771562067172-27ac6834a522f400.pdf	application/pdf	179152	/uploads/1771562067172-27ac6834a522f400.pdf	\N	2026-02-20 04:34:27.199173	creacion	\N	\N
8	solicitud	32	Anticipo repuestos Saturn 4.pdf	1771564118054-9eeb126255bff0a7.pdf	application/pdf	179152	/uploads/1771564118054-9eeb126255bff0a7.pdf	5	2026-02-20 05:08:38.089184	creacion	\N	\N
9	solicitud	32	Anticipo repuestos Saturn 4.pdf	1771564118103-8e3fb30a058a2548.pdf	application/pdf	179152	/uploads/1771564118103-8e3fb30a058a2548.pdf	5	2026-02-20 05:08:38.123236	creacion	\N	\N
10	ticket	999	test_archivo.txt	1771564201232-10029a0332832af9.txt	text/plain	13	/uploads/1771564201232-10029a0332832af9.txt	\N	2026-02-20 05:10:01.232936	creacion	\N	\N
11	ticket	999	test_archivo.txt	1771564225088-f6fb05dbc1b83634.txt	text/plain	13	/uploads/1771564225088-f6fb05dbc1b83634.txt	\N	2026-02-20 05:10:25.088649	creacion	\N	\N
12	ticket	999	test_archivo2.txt	1771564281840-8edf9e350327e330.txt	text/plain	13	/uploads/1771564281840-8edf9e350327e330.txt	\N	2026-02-20 05:11:21.843142	reporte_evidencia	\N	\N
13	solicitud	33	Anticipo repuestos Saturn 4.pdf	1771564422439-04c3317e97b80dce.pdf	application/pdf	179152	/uploads/1771564422439-04c3317e97b80dce.pdf	5	2026-02-20 05:13:42.473198	problematica_evidencia	\N	\N
14	solicitud	33	Anticipo repuestos Saturn 4.pdf	1771564422521-c1fdb8312b36da1c.pdf	application/pdf	179152	/uploads/1771564422521-c1fdb8312b36da1c.pdf	5	2026-02-20 05:13:42.533026	solucion_referencias	\N	\N
15	solicitud	33	Anticipo repuestos Saturn 4.pdf	1771564422560-8a28f37080dd83e8.pdf	application/pdf	179152	/uploads/1771564422560-8a28f37080dd83e8.pdf	5	2026-02-20 05:13:42.570917	adjuntos_generales	\N	\N
\.


--
-- Data for Name: codigos_verificacion; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.codigos_verificacion (id, email, nombre, codigo, usado, intentos, expira_en, creado_en) FROM stdin;
1	andreskks998@gmail.com	Andrés Pérez	987223	f	0	2026-02-11 20:49:55.193	2026-02-11 20:34:55.193521
2	andreskks998@gmail.com	Andrés Pérez	363611	f	0	2026-02-12 13:13:19.329	2026-02-12 12:58:19.330142
3	ing.tecnologia1@inemec.com	Andres Perez	125721	f	0	2026-02-12 16:30:52.872	2026-02-12 16:15:52.872884
4	andreskks998@gmail.com	Test1	319661	t	0	2026-02-12 16:42:16.482	2026-02-12 16:27:16.48332
5	andreskks998@gmail.com	Andres	555022	t	0	2026-02-12 18:13:24.457	2026-02-12 17:58:24.457345
6	andreskks998@gmail.com	Andres Perez	742223	t	0	2026-02-12 19:17:33.974	2026-02-12 19:02:33.974776
7	andreskk98@gmail.com	Manuel	927127	f	0	2026-02-12 19:23:04.188	2026-02-12 19:08:04.188984
8	andreskk98@gmail.com	Manuel	627540	f	0	2026-02-12 19:24:04.58	2026-02-12 19:09:04.580943
9	andreskk988@gmail.com	Manuel	925499	f	0	2026-02-12 19:24:13.257	2026-02-12 19:09:13.257448
10	andreskk998@gmail.com	Manuel	778236	f	0	2026-02-12 19:24:21.882	2026-02-12 19:09:21.882851
11	andreskks998@gmail.com	Manuel	400299	t	0	2026-02-12 19:24:28.591	2026-02-12 19:09:28.59198
12	andreskks998@gmail.com	Andrés	549517	t	0	2026-02-15 14:31:05.847	2026-02-15 14:16:05.847427
13	andreskks998@gmail.com	Andrew	279623	t	0	2026-02-15 15:04:26.595	2026-02-15 14:49:26.595955
14	andreskks998@gmail.com	andrew	431815	t	0	2026-02-15 15:09:46.783	2026-02-15 14:54:46.784374
15	andreskks998@gmail.com	andrew2	891486	t	0	2026-02-15 15:13:17.504	2026-02-15 14:58:17.505129
16	andreskks998@gmail.com	andrew2	653536	t	0	2026-02-16 12:34:38.628	2026-02-16 12:19:38.628363
17	andreskks998@gmail.com	andrew3	502762	t	0	2026-02-16 12:38:17.439	2026-02-16 12:23:17.43921
18	andreskks998@gmail.com	andrew4	583113	t	0	2026-02-16 12:51:00.445	2026-02-16 12:36:00.446196
19	andreskks998@gmail.com	andrew 5	774040	t	0	2026-02-16 12:55:50.183	2026-02-16 12:40:50.183257
20	andreskks998@gmail.com	andres Perez	574598	t	0	2026-02-16 12:57:44.71	2026-02-16 12:42:44.710991
21	andreskks998@gmail.com	camila ramos	274306	t	0	2026-02-16 16:40:05.428	2026-02-16 16:25:05.428785
22	andreskks998@gmail.com	test 87	437822	f	0	2026-02-16 17:12:00.489	2026-02-16 16:57:00.48987
23	andreskks98@gmail.com	andrew	587476	f	0	2026-02-16 17:16:42.177	2026-02-16 17:01:42.177964
24	andreskks998@gmail.com	andrew	380213	t	0	2026-02-16 17:17:24.446	2026-02-16 17:02:24.446956
25	andreskks998@gmail.com	test	918766	t	0	2026-02-17 18:04:55.563	2026-02-17 17:49:55.56325
26	gte.comercial@inemec.com	Gabriel Fernando Cordoba	499781	t	0	2026-02-17 18:16:54.611	2026-02-17 18:01:54.611694
27	andreskks998@gmail.com	prueba	389647	t	0	2026-02-18 19:21:11.395	2026-02-18 19:06:11.395665
28	andreskks998@gmail.com	Test	710429	t	0	2026-02-19 20:27:41.685	2026-02-19 20:12:41.685505
29	andreskks998@gmail.com	andreskks998@gmail.com	523243	t	0	2026-02-19 20:42:44.705	2026-02-19 20:27:44.705736
\.


--
-- Data for Name: comentarios; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.comentarios (id, entidad_tipo, entidad_id, usuario_id, contenido, tipo, interno, creado_en, autor_externo) FROM stdin;
1	solicitud	1	5	Hola	comentario	f	2026-02-16 00:57:51.490013	\N
2	solicitud	3	5	Solicitud descartada por NT	cambio_estado	f	2026-02-16 01:10:02.318374	\N
3	solicitud	2	5	Tomando solicitud	cambio_estado	f	2026-02-16 01:10:33.169666	\N
4	solicitud	2	5	Devuelto a pendiente	cambio_estado	f	2026-02-16 01:10:52.619156	\N
5	solicitud	2	5	Tomando solicitud	cambio_estado	f	2026-02-16 01:10:59.824846	\N
6	solicitud	2	5	Solicitud no realizada	cambio_estado	f	2026-02-16 01:11:19.154791	\N
7	solicitud	1	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-16 01:11:29.651567	\N
8	ticket	7	9	Ticket transferido a Nuevas Tecnologías. Nueva solicitud: SOL-202602-0010\nMotivo: hoo	transferencia	f	2026-02-16 12:45:30.666322	\N
9	solicitud	10	5	Solicitud descartada por NT	cambio_estado	f	2026-02-16 12:49:13.913069	\N
10	solicitud	9	5	Tomando solicitud	cambio_estado	f	2026-02-16 12:49:21.248383	\N
11	solicitud	9	5	Devuelto a pendiente	cambio_estado	f	2026-02-16 12:49:24.124696	\N
12	solicitud	9	5	Solicitud descartada por NT	cambio_estado	f	2026-02-16 12:49:26.87944	\N
13	solicitud	8	5	Tomando solicitud	cambio_estado	f	2026-02-16 12:49:33.946324	\N
14	solicitud	8	5	Solicitud no realizada	cambio_estado	f	2026-02-16 12:49:37.687172	\N
15	solicitud	7	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-16 12:49:50.660144	\N
16	ticket	8	3	Ticket transferido a Nuevas Tecnologías. Nueva solicitud: SOL-202602-0011\nMotivo: Requiere evaluación técnica avanzada	transferencia	f	2026-02-16 13:04:41.754079	\N
17	solicitud	7	4	Reevaluación solicitada:\nNecesita más detalles en el cronograma\n\nÁreas a revisar: cronograma, costos	reevaluacion	f	2026-02-16 13:10:53.471753	\N
18	solicitud	11	5	Solicitud descartada por NT	cambio_estado	f	2026-02-16 13:12:30.68685	\N
19	solicitud	6	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-16 13:12:45.889794	\N
20	solicitud	6	6	Reevaluación solicitada:\njj\n\nÁreas a revisar: cronograma	reevaluacion	f	2026-02-16 14:01:06.055148	\N
21	solicitud	5	7	Tomando solicitud	cambio_estado	f	2026-02-16 14:52:50.580788	\N
22	solicitud	5	5	Solicitud completada	cambio_estado	f	2026-02-16 17:06:04.934847	\N
23	solicitud	6	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-16 17:06:15.754307	\N
24	solicitud	7	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-17 16:53:47.088965	\N
25	solicitud	12	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-17 17:56:15.97197	\N
26	solicitud	13	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-17 18:28:55.574355	\N
27	ticket	22	9	Hola	comentario	f	2026-02-20 02:24:17.858662	\N
28	ticket	28	9	Ticket transferido a Nuevas Tecnologías. Nueva solicitud: SOL-202602-0031\nMotivo: knllklmlkk	transferencia	f	2026-02-20 04:53:25.251267	\N
29	solicitud	33	5	jlfje	interno	t	2026-02-20 05:38:53.08813	\N
30	solicitud	33	5	Test 1	publico	f	2026-02-20 05:45:08.469054	\N
31	solicitud	33	5	Test 2	interno	t	2026-02-20 05:45:16.156492	\N
32	solicitud	33	5	Test 3	comunicacion	f	2026-02-20 05:45:29.042312	\N
33	solicitud	33	\N	response 3	respuesta	f	2026-02-20 05:56:10.329363	fjpkeof
34	solicitud	32	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-20 06:10:46.182213	\N
35	solicitud	33	5	Iniciando análisis de la solicitud	cambio_estado	f	2026-02-20 06:21:24.786112	\N
36	ticket	26	9	Ticket transferido a Nuevas Tecnologías. Nueva solicitud: SOL-202602-0034\nMotivo: test1	transferencia	f	2026-02-20 06:28:28.380805	\N
37	ticket	25	9	Ticket transferido a Nuevas Tecnologías. Nueva solicitud: SOL-202602-0035\nMotivo: test 2	transferencia	f	2026-02-20 06:28:51.910733	\N
38	ticket	27	9	Ticket transferido a Nuevas Tecnologías. Nueva solicitud: SOL-202602-0036\nMotivo: transfer	transferencia	f	2026-02-20 06:53:26.769669	\N
39	solicitud	29	5	Solicitud transferida a TI. Nuevo ticket: TKT-202602-0025\nMotivo: transfer	transferencia	f	2026-02-20 07:24:08.97713	\N
40	solicitud	12	5	Edición de solicitud:\n• Stakeholders Internos - Áreas: "a" → "a,b"\n• Desempeño - Compromiso del Sponsor: "--" → "No"	edicion	t	2026-02-20 08:38:27.593786	\N
41	solicitud	35	5	Solicitud completada	cambio_estado	t	2026-02-20 08:58:27.701008	\N
42	solicitud	34	5	Solicitud completada	cambio_estado	t	2026-02-20 08:58:37.740382	\N
43	solicitud	33	6	Agendado desde el calendario. Duración: 26 días hábiles.	agendamiento	f	2026-02-20 11:44:36.385487	\N
44	solicitud	6	6	Agendado desde el calendario. Duración: 45 días hábiles.	agendamiento	f	2026-02-20 11:45:32.067664	\N
\.


--
-- Data for Name: comentarios_reevaluacion; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.comentarios_reevaluacion (id, solicitud_id, evaluacion_id, gerente_id, tipo, contenido, areas_revisar, leido_por_nt, leido_en, creado_en) FROM stdin;
1	7	\N	4	reevaluacion	Necesita más detalles en el cronograma	["cronograma", "costos"]	f	\N	2026-02-16 13:10:53.471753
2	6	\N	6	reevaluacion	jj	["cronograma"]	f	\N	2026-02-16 14:01:06.055148
\.


--
-- Data for Name: conocimiento_articulos; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.conocimiento_articulos (id, titulo, slug, resumen, contenido, categoria_id, autor_id, etiquetas, publicado, vistas, creado_en, actualizado_en) FROM stdin;
1	Bienvenido al Portal de Conocimiento	bienvenido-portal-conocimiento	Introducción al Portal de Gestión de Proyectos y Conocimiento Tecnológico de INEMEC	# Bienvenido al Portal de Conocimiento\r\n\r\nEste portal centraliza la documentación técnica, guías y recursos de INEMEC S.A.\r\n\r\n## Secciones Principales\r\n\r\n- **Guías Técnicas**: Documentación técnica detallada\r\n- **Procedimientos**: Procesos estandarizados\r\n- **FAQ**: Respuestas a preguntas comunes\r\n- **Tutoriales**: Guías paso a paso\r\n\r\n## Cómo Usar el Portal\r\n\r\nNavegue por las categorías o use la búsqueda para encontrar información específica.\r\n\r\nPara solicitar nuevos artículos o reportar errores, contacte al equipo de Nuevas Tecnologías.	1	1	{introduccion,guia,inicio}	t	20	2026-02-11 20:12:49.740155	2026-02-19 21:06:04.109323
\.


--
-- Data for Name: conocimiento_categorias; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.conocimiento_categorias (id, nombre, descripcion, orden, creado_en) FROM stdin;
1	Guías Técnicas	Documentación técnica y guías de implementación	1	2026-02-11 20:12:49.733962
2	Procedimientos	Procedimientos estándar de operación	2	2026-02-11 20:12:49.733962
3	FAQ	Preguntas frecuentes	3	2026-02-11 20:12:49.733962
4	Tutoriales	Tutoriales paso a paso	4	2026-02-11 20:12:49.733962
5	Políticas	Políticas y normativas	5	2026-02-11 20:12:49.733962
\.


--
-- Data for Name: cronograma_tareas; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.cronograma_tareas (id, cronograma_id, titulo, descripcion, fecha_inicio, fecha_fin, duracion_dias, dependencia_ids, orden, color, progreso, creado_en, nombre, duracion, dependencias, fase, asignado_id, asignados_ids, es_emergente, completado) FROM stdin;
1	1	Análisis	\N	2026-03-01	2026-03-15	10	{}	0	#1890ff	0	2026-02-16 03:39:36.638867	Análisis de Requerimientos	10	[]	analisis	\N	[]	f	f
2	1	Diseño	\N	2026-03-16	2026-03-31	12	{}	1	#1890ff	0	2026-02-16 03:39:36.638867	Diseño del Sistema	12	[]	diseno	\N	[]	f	f
3	1	Desarrollo	\N	2026-04-01	2026-05-10	30	{}	2	#1890ff	0	2026-02-16 03:39:36.638867	Desarrollo	30	[]	desarrollo	\N	[]	f	f
4	1	Pruebas	\N	2026-05-11	2026-05-25	10	{}	3	#1890ff	0	2026-02-16 03:39:36.638867	Pruebas	10	[]	pruebas	\N	[]	f	f
5	1	Despliegue	\N	2026-05-26	2026-05-30	3	{}	4	#1890ff	0	2026-02-16 03:39:36.638867	Despliegue	3	[]	entrega	\N	[]	f	f
27	6	Updated Task	\N	2026-03-01	2026-03-05	\N	{}	0	#1890ff	0	2026-02-16 13:52:16.05782	Updated Task	\N	[]	analisis	5	[]	f	f
35	15	Análisis de Requerimientos	\N	\N	\N	4	{}	0	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	[]	analisis	5	[]	f	f
36	15	Diseño UX Mobile	\N	\N	\N	5	{}	1	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-0"]	diseno	5	[]	f	f
37	15	Diseño UI Mobile	\N	\N	\N	5	{}	2	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-1"]	diseno	5	[]	f	f
38	15	Arquitectura App	\N	\N	\N	3	{}	3	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-0"]	diseno	5	[]	f	f
39	15	Desarrollo API	\N	\N	\N	10	{}	4	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-3"]	desarrollo	5	[]	f	f
40	15	Desarrollo App - Core	\N	\N	\N	12	{}	5	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-2", "task-4"]	desarrollo	5	[]	f	f
41	15	Desarrollo App - Features	\N	\N	\N	10	{}	6	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-5"]	desarrollo	5	[]	f	f
42	15	Pruebas en Dispositivos	\N	\N	\N	5	{}	7	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-6"]	pruebas	5	[]	f	f
43	15	Pruebas de Performance	\N	\N	\N	3	{}	8	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-7"]	pruebas	5	[]	f	f
44	15	Corrección de Bugs	\N	\N	\N	4	{}	9	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-8"]	pruebas	5	[]	f	f
45	15	Publicación App Store	\N	\N	\N	3	{}	10	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-9"]	entrega	5	[]	f	f
46	15	Documentación	\N	\N	\N	2	{}	11	#1890ff	0	2026-02-19 19:39:19.475621	\N	\N	["task-9"]	documentacion	5	[]	f	f
47	16	Levantamiento de Requerimientos	\N	\N	\N	5	{}	0	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	[]	analisis	\N	[5, 7]	f	f
48	16	Análisis Técnico	\N	\N	\N	3	{}	1	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-0"]	analisis	\N	[5]	f	f
49	16	Arquitectura de Solución	\N	\N	\N	3	{}	2	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-1"]	diseno	\N	[]	f	f
50	16	Diseño de Base de Datos	\N	\N	\N	3	{}	3	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-1"]	diseno	\N	[]	f	f
51	16	Diseño UI/UX	\N	\N	\N	5	{}	4	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-2"]	diseno	\N	[]	f	f
52	16	Sprint 1 - Core	\N	\N	\N	10	{}	5	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-3", "task-4"]	desarrollo	\N	[]	f	f
53	16	Sprint 2 - Features	\N	\N	\N	10	{}	6	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-5"]	desarrollo	\N	[]	f	f
54	16	Pruebas Unitarias	\N	\N	\N	3	{}	7	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-6"]	pruebas	\N	[]	f	f
55	16	Pruebas de Integración	\N	\N	\N	3	{}	8	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-7"]	pruebas	\N	[]	f	f
56	16	UAT	\N	\N	\N	5	{}	9	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-8"]	pruebas	\N	[]	f	f
57	16	Documentación	\N	\N	\N	3	{}	10	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-9"]	documentacion	\N	[]	f	f
58	16	Capacitación	\N	\N	\N	2	{}	11	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-10"]	entrega	\N	[]	f	f
59	16	Despliegue Producción	\N	\N	\N	2	{}	12	#1890ff	0	2026-02-19 20:47:31.400019	\N	\N	["task-11"]	entrega	\N	[]	f	f
72	7	a	\N	\N	\N	10	{}	0	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Análisis	\N	[5]	f	f
73	7	b	\N	\N	\N	2	{}	1	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Análisis	\N	[5, 7]	f	f
74	7	c	\N	\N	\N	4	{}	2	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Análisis	\N	[7]	f	f
75	7	a	\N	\N	\N	8	{}	3	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Desarrollo	\N	[5]	f	f
76	7	b	\N	\N	\N	6	{}	4	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Desarrollo	\N	[7]	f	f
77	7	c	\N	\N	\N	2	{}	5	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Desarrollo	\N	[5]	f	f
78	7	d	\N	\N	\N	7	{}	6	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Desarrollo	\N	[5]	f	f
79	7	a	\N	\N	\N	2	{}	7	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Despliegue	\N	[7]	f	f
80	7	b	\N	\N	\N	4	{}	8	#1890ff	0	2026-02-19 23:46:30.895528	\N	\N	[]	Despliegue	\N	[5, 7]	f	f
81	17	1	\N	\N	\N	3	{}	0	#1890ff	0	2026-02-20 09:00:29.520956	\N	\N	[]	a	\N	[5]	f	f
82	17	2	\N	\N	\N	2	{}	1	#1890ff	0	2026-02-20 09:00:29.520956	\N	\N	[]	a	\N	[5]	f	f
83	17	3	\N	\N	\N	5	{}	2	#1890ff	0	2026-02-20 09:00:29.520956	\N	\N	[]	a	\N	[5]	f	f
84	17	1	\N	\N	\N	2	{}	3	#1890ff	0	2026-02-20 09:00:29.520956	\N	\N	[]	b	\N	[5]	f	f
85	17	1	\N	\N	\N	10	{}	4	#1890ff	0	2026-02-20 09:00:29.520956	\N	\N	[]	c	\N	[5]	f	f
86	17	2	\N	\N	\N	4	{}	5	#1890ff	0	2026-02-20 09:00:29.520956	\N	\N	[]	c	\N	[5]	f	f
87	18	1	\N	\N	\N	10	{}	0	#1890ff	0	2026-02-20 11:46:52.579419	\N	\N	[]	a	\N	[5]	f	f
88	18	2	\N	\N	\N	6	{}	1	#1890ff	0	2026-02-20 11:46:52.579419	\N	\N	[]	b	\N	[5]	f	f
\.


--
-- Data for Name: cronogramas; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.cronogramas (id, evaluacion_id, solicitud_id, plantilla_origen, fecha_inicio_propuesta, fecha_fin_propuesta, duracion_dias_habiles, datos, creado_en, actualizado_en, nombre, fecha_inicio, fecha_fin, equipo_ids, fases) FROM stdin;
1	1	1	\N	\N	\N	\N	{}	2026-02-16 03:39:36.616374	2026-02-16 03:39:36.616374	Cronograma Proyecto Interno Test	2026-03-01	2026-05-30	[]	[]
6	2	\N	\N	\N	\N	\N	{}	2026-02-16 12:59:53.653788	2026-02-16 13:52:16.05782	Updated Cronograma	2026-02-16	2026-03-16	[]	[]
15	4	\N	\N	\N	\N	66	{}	2026-02-19 19:39:19.475621	2026-02-19 19:39:19.475621	Proyecto Móvil	\N	\N	[]	[]
16	5	\N	\N	\N	\N	57	{}	2026-02-19 20:47:31.400019	2026-02-19 20:47:31.400019	Proyecto Web Mediano	\N	\N	[5, 7]	[]
7	3	\N	\N	\N	\N	111	{}	2026-02-16 13:13:15.142409	2026-02-19 23:46:30.895528	Proyecto Móvil	2026-02-02	2026-04-21	[5, 7]	["Análisis", "Desarrollo", "Despliegue"]
17	6	\N	\N	\N	\N	26	{}	2026-02-20 09:00:29.520956	2026-02-20 09:00:29.520956	Cronograma del Proyecto	\N	\N	[5]	["a", "b", "c"]
18	7	\N	\N	\N	\N	16	{}	2026-02-20 11:46:52.579419	2026-02-20 11:46:52.579419	Cronograma del Proyecto	\N	\N	[5]	["a", "b"]
\.


--
-- Data for Name: estimaciones_costo; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.estimaciones_costo (id, evaluacion_id, desarrollo_interno_horas, tarifa_hora, infraestructura_old, servicios_externos_old, contingencia_porcentaje, total_estimado, desglose, notas, creado_en, actualizado_en, desarrollo_interno, subtotal_desarrollo, subtotal_infraestructura, subtotal_externos, subtotal, contingencia, total, infraestructura, servicios_externos) FROM stdin;
1	1	0.00	0.00	0.00	0.00	15.00	\N	{}	\N	2026-02-16 03:39:36.644308	2026-02-16 03:39:36.644308	[{"horas": 400, "concepto": "Desarrollo Backend", "subtotal": 20000000, "tarifa_hora": 50000}, {"horas": 300, "concepto": "Desarrollo Frontend", "subtotal": 13500000, "tarifa_hora": 45000}]	33500000.00	8000000.00	5000000.00	46500000.00	6975000.00	53475000.00	[{"meses": 12, "concepto": "Servidor Cloud", "subtotal": 6000000, "costo_mensual": 500000}, {"concepto": "Licencias", "subtotal": 2000000, "costo_unico": 2000000}]	[{"monto": 5000000, "concepto": "Consultoría UX", "proveedor": "UX Experts"}]
2	3	0.00	0.00	0.00	0.00	0.00	\N	{}		2026-02-16 13:13:28.555713	2026-02-20 00:37:46.375293	[]	0.00	0.00	0.00	0.00	0.00	0.00	[]	[]
3	6	0.00	0.00	0.00	0.00	0.00	\N	{}		2026-02-20 09:00:33.989247	2026-02-20 09:00:33.989247	[]	0.00	0.00	0.00	0.00	0.00	0.00	[]	[]
4	7	0.00	0.00	0.00	0.00	0.00	\N	{}		2026-02-20 11:47:01.31752	2026-02-20 11:47:01.31752	[]	0.00	0.00	10000.00	10000.00	1000.00	11000.00	[]	[{"iva": 0, "monto": 10000, "concepto": "sd", "proveedor": ""}]
\.


--
-- Data for Name: evaluacion_asignaciones; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.evaluacion_asignaciones (id, evaluacion_id, usuario_id, rol, es_lider, horas_estimadas, fecha_asignacion) FROM stdin;
1	1	5	Líder de Proyecto	t	200	2026-02-16 02:54:21.372696
2	1	7	Desarrollador Senior	f	400	2026-02-16 02:54:21.372696
3	4	5	Líder del Proyecto	t	\N	2026-02-19 19:39:19.652974
4	5	5	Líder del Proyecto	t	\N	2026-02-19 20:47:31.48666
5	3	5	Líder del Proyecto	t	\N	2026-02-19 23:46:31.022074
6	6	5	Líder del Proyecto	t	\N	2026-02-20 09:00:29.586351
7	7	5	Líder del Proyecto	t	\N	2026-02-20 11:46:52.662455
\.


--
-- Data for Name: evaluaciones_nt; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.evaluaciones_nt (id, solicitud_id, evaluador_id, resumen_ejecutivo, recomendacion, justificacion_recomendacion, datos_adicionales, estado, enviado_en, creado_en, actualizado_en, riesgos_identificados, notas_adicionales, fecha_envio, fecha_inicio_posible, lider_id) FROM stdin;
1	1	5	Este proyecto propone implementar un nuevo sistema de gestión. Se considera viable y beneficioso para la organización.	aprobar	El proyecto tiene un ROI estimado del 150% en 2 años. Los riesgos identificados son manejables.	{}	aprobado	\N	2026-02-16 02:54:07.975686	2026-02-16 03:41:47.213228	["Dependencia de proveedores externos", "Curva de aprendizaje del equipo"]	Se recomienda iniciar con un piloto antes del despliegue completo.	2026-02-16 03:40:17.14842	\N	\N
2	7	5	hkhl	aprobar	bjkbk	{}	borrador	\N	2026-02-16 12:50:28.295037	2026-02-17 16:53:51.786206	[]	hhll	\N	\N	\N
5	13	5	sdafa	aprobar	fsd	{}	borrador	\N	2026-02-17 18:29:47.27996	2026-02-17 18:29:47.27996	[]	\N	\N	\N	\N
4	12	5	jopjpp	aplazar	nlkl	{}	borrador	\N	2026-02-17 17:56:42.401404	2026-02-19 20:55:35.378903	[]	\N	\N	\N	\N
3	6	5	jnkkn	aprobar	 nklnlnl	{}	enviado	\N	2026-02-16 13:12:56.871971	2026-02-20 02:00:18.530993	[]	\N	2026-02-20 02:00:18.530993	\N	\N
6	33	5	mofkdp	aprobar	fjoeifmo	{}	enviado	\N	2026-02-20 08:59:15.428379	2026-02-20 09:00:42.036235	[]	\N	2026-02-20 09:00:42.036235	2026-02-21	\N
7	32	5	feaf	aprobar	efaef	{}	enviado	\N	2026-02-20 11:46:20.995748	2026-02-20 11:47:06.997396	[]	\N	2026-02-20 11:47:06.997396	2026-02-21	\N
\.


--
-- Data for Name: festivos_colombia; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.festivos_colombia (id, fecha, nombre, tipo, ano, creado_en) FROM stdin;
1	2025-01-01	Ano Nuevo	fijo	2025	2026-02-15 19:21:34.227105
2	2025-05-01	Dia del Trabajo	fijo	2025	2026-02-15 19:21:34.227105
3	2025-07-20	Dia de la Independencia	fijo	2025	2026-02-15 19:21:34.227105
4	2025-08-07	Batalla de Boyaca	fijo	2025	2026-02-15 19:21:34.227105
5	2025-12-08	Inmaculada Concepcion	fijo	2025	2026-02-15 19:21:34.227105
6	2025-12-25	Navidad	fijo	2025	2026-02-15 19:21:34.227105
7	2025-01-06	Dia de los Reyes Magos	ley_emiliani	2025	2026-02-15 19:21:34.227105
8	2025-03-24	San Jose	ley_emiliani	2025	2026-02-15 19:21:34.227105
9	2025-06-30	San Pedro y San Pablo	ley_emiliani	2025	2026-02-15 19:21:34.227105
10	2025-08-18	Asuncion de la Virgen	ley_emiliani	2025	2026-02-15 19:21:34.227105
11	2025-10-13	Dia de la Raza	ley_emiliani	2025	2026-02-15 19:21:34.227105
12	2025-11-03	Todos los Santos	ley_emiliani	2025	2026-02-15 19:21:34.227105
13	2025-11-17	Independencia de Cartagena	ley_emiliani	2025	2026-02-15 19:21:34.227105
14	2025-04-17	Jueves Santo	variable	2025	2026-02-15 19:21:34.227105
15	2025-04-18	Viernes Santo	variable	2025	2026-02-15 19:21:34.227105
16	2025-06-02	Ascension del Senor	variable	2025	2026-02-15 19:21:34.227105
17	2025-06-23	Corpus Christi	variable	2025	2026-02-15 19:21:34.227105
19	2026-01-01	Ano Nuevo	fijo	2026	2026-02-15 19:21:34.240665
20	2026-05-01	Dia del Trabajo	fijo	2026	2026-02-15 19:21:34.240665
21	2026-07-20	Dia de la Independencia	fijo	2026	2026-02-15 19:21:34.240665
22	2026-08-07	Batalla de Boyaca	fijo	2026	2026-02-15 19:21:34.240665
23	2026-12-08	Inmaculada Concepcion	fijo	2026	2026-02-15 19:21:34.240665
24	2026-12-25	Navidad	fijo	2026	2026-02-15 19:21:34.240665
25	2026-01-12	Dia de los Reyes Magos	ley_emiliani	2026	2026-02-15 19:21:34.240665
26	2026-03-23	San Jose	ley_emiliani	2026	2026-02-15 19:21:34.240665
27	2026-06-29	San Pedro y San Pablo	ley_emiliani	2026	2026-02-15 19:21:34.240665
28	2026-08-17	Asuncion de la Virgen	ley_emiliani	2026	2026-02-15 19:21:34.240665
29	2026-10-12	Dia de la Raza	ley_emiliani	2026	2026-02-15 19:21:34.240665
30	2026-11-02	Todos los Santos	ley_emiliani	2026	2026-02-15 19:21:34.240665
31	2026-11-16	Independencia de Cartagena	ley_emiliani	2026	2026-02-15 19:21:34.240665
32	2026-04-02	Jueves Santo	variable	2026	2026-02-15 19:21:34.240665
33	2026-04-03	Viernes Santo	variable	2026	2026-02-15 19:21:34.240665
34	2026-05-18	Ascension del Senor	variable	2026	2026-02-15 19:21:34.240665
35	2026-06-08	Corpus Christi	variable	2026	2026-02-15 19:21:34.240665
36	2026-06-15	Sagrado Corazon	variable	2026	2026-02-15 19:21:34.240665
\.


--
-- Data for Name: historial_cambios; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.historial_cambios (id, entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_id, ip_address, creado_en) FROM stdin;
1	solicitud	1	crear	\N	{"id": 1, "kpis": [], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0001", "estado": "pendiente_evaluacion_nt", "titulo": "Proyecto: test desc...", "creado_en": "2026-02-15T14:53:04.295Z", "prioridad": "alta", "beneficios": {"descripcion": "test benefit", "mejora_concreta": "Test mejora"}, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-15T14:53:04.295Z", "motivo_rechazo": null, "solicitante_id": 1, "datos_solicitante": {"area": "gerencia_general", "cargo": "test Cargo", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Test", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {}}, "necesidad_urgencia": {"nivel": "corto_plazo", "justificacion_nt": "NT", "necesidad_principal": "test necesity"}, "solucion_propuesta": {"funcionalidades_minimas": ["Test function"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "test origin", "impacto_nivel": "baja", "situacion_actual": "test desc", "impacto_descripcion": "test impact", "afectacion_operacion": "test effect", "procesos_comprometidos": "test process"}}	\N	::ffff:192.168.0.7	2026-02-15 14:53:04.322708
2	solicitud	2	crear	\N	{"id": 2, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0002", "estado": "pendiente_evaluacion_nt", "titulo": "Fallo: fallo fallo fallo fallo...", "creado_en": "2026-02-15T15:01:15.305Z", "prioridad": "critica", "beneficios": {}, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-15T15:01:15.305Z", "motivo_rechazo": null, "solicitante_id": 1, "datos_solicitante": {"area": "gerencia_general", "cargo": "it", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "andres Pérez", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "necesidad_urgencia": {"urgencia": "critica", "justificacion": "para operacion"}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"descripcion": "fallo fallo fallo fallo"}}	\N	::ffff:192.168.0.7	2026-02-15 15:01:15.331542
3	solicitud	3	crear	\N	{"id": 3, "kpis": [], "tipo": "cierre_servicio", "codigo": "SOL-2026-0003", "estado": "pendiente_evaluacion_nt", "titulo": "Cierre: cierre cierre cierre...", "creado_en": "2026-02-15T15:02:14.700Z", "prioridad": "media", "beneficios": {}, "declaracion": {"confirmacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-15T15:02:14.700Z", "motivo_rechazo": null, "solicitante_id": 1, "datos_solicitante": {"area": "gerencia_general", "cargo": "it", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Jesus", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "necesidad_urgencia": {}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"descripcion": "cierre cierre cierre"}}	\N	::ffff:192.168.0.7	2026-02-15 15:02:14.712539
4	solicitud	3	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "descartado_nt", "comentario": "Solicitud descartada por NT"}	5	\N	2026-02-16 01:10:02.318374
5	solicitud	2	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_proceso", "comentario": "Tomando solicitud"}	5	\N	2026-02-16 01:10:33.169666
6	solicitud	2	cambio_estado	{"estado": "en_proceso"}	{"estado": "pendiente_evaluacion_nt", "comentario": "Devuelto a pendiente"}	5	\N	2026-02-16 01:10:52.619156
7	solicitud	2	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_proceso", "comentario": "Tomando solicitud"}	5	\N	2026-02-16 01:10:59.824846
8	solicitud	2	cambio_estado	{"estado": "en_proceso"}	{"estado": "no_realizado", "comentario": "Solicitud no realizada"}	5	\N	2026-02-16 01:11:19.154791
9	solicitud	1	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-16 01:11:29.651567
10	solicitud	1	aprobacion_gerencia	{"estado": "pendiente_aprobacion_gerencia"}	{"estado": "agendado", "fecha_fin": "2026-06-30", "fecha_inicio": "2026-04-01"}	6	\N	2026-02-16 03:41:47.213228
11	solicitud	6	crear	\N	{"id": 6, "kpis": [{"nombre": "kpi", "unidad": "20", "valor_actual": "0", "valor_objetivo": "30"}], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0006", "estado": "pendiente_evaluacion_nt", "titulo": "Proyecto: problema test NT...", "creado_en": "2026-02-16T12:35:16.937Z", "prioridad": "critica", "beneficios": {"descripcion": "hfiosajd", "mejora_concreta": "knsflkad", "reduccion_costos": false, "procesos_optimizados": ["proceso"]}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-16T12:35:16.937Z", "motivo_rechazo": null, "solicitante_id": null, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "NT", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andrés Pérez", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {"areas": ["it"], "personas": ["jesus cotes"]}, "aplica_externas": false}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "inmediata", "fecha_limite": "2026-02-19T05:00:00.000Z", "justificacion_nt": "nadifh", "necesidad_principal": "na"}, "solucion_propuesta": {"tipo": "automatizacion", "casos_uso": "hflakhdjenejaknflanksdkl", "referencias": [{"uid": "rc-upload-1771244541616-7", "name": "CV_Andres_Perez_Espanol.pdf", "size": 112468, "status": "done", "originFileObj": {"uid": "rc-upload-1771244541616-7"}}], "forma_entrega": "web", "tipo_descripcion": "djlkjd", "usuarios_finales": ["Jesus cotes"], "descripcion_ideal": "djlksahflshlkanjkenalknd", "tiene_restricciones": false, "funcionalidades_minimas": ["Aplicación"], "funcionalidades_deseables": ["jdojr"]}, "usuario_creador_id": 5, "descripcion_problema": {"origen": "Origen test NT", "evidencia": [{"uid": "rc-upload-1771244541616-11", "name": "CV_Andres_Perez_Espanol.pdf", "size": 112468, "status": "done", "originFileObj": {"uid": "rc-upload-1771244541616-11"}}], "fecha_inicio": "2026-02-28T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "problema test NT", "impacto_descripcion": "nod", "afectacion_operacion": "Efecto TEst nt", "procesos_comprometidos": "TODOS"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	5	::ffff:192.168.0.7	2026-02-16 12:35:16.96544
12	solicitud	7	crear	\N	{"id": 7, "kpis": [{"nombre": "jfpoeajpñf", "unidad": "m", "valor_actual": "2", "valor_objetivo": "30"}, {"nombre": "jfoeia", "unidad": "h", "valor_actual": "0", "valor_objetivo": "30"}], "tipo": "actualizacion", "codigo": "SOL-2026-0007", "estado": "pendiente_evaluacion_nt", "titulo": "Actualización: djklfjl...", "creado_en": "2026-02-16T12:40:19.349Z", "prioridad": "alta", "beneficios": {"descripcion": "jfejapñef", "mejora_concreta": "jefñajñfe", "reduccion_costos": true, "costos_descripcion": "oejakfpojpfjae", "procesos_optimizados": ["jefijlaef"]}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-16T12:40:19.349Z", "motivo_rechazo": null, "solicitante_id": null, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "nt", "cedula": "1005257395", "correo": "Andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andrés Pérez", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"externas": {"empresas": ["sjdkla"], "personas": ["jdklasd"], "sectores": ["djklfk"], "proveedores": ["sdjdl"]}, "internas": {"areas": ["ajdk"], "personas": ["adjk"]}, "aplica_externas": true}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "corto_plazo", "fecha_limite": "2026-02-20T05:00:00.000Z", "justificacion_nt": "jflkslf", "necesidad_principal": "jflkslf"}, "solucion_propuesta": {"tipo": "reporte_dashboard", "casos_uso": "jfsafjpoejpoajmñfojonevibnihbiuhaisjnjaeifohnijoqj\\nfjoieajjm\\ndjiafjña\\nflsjfljfña\\nfjsajfñjñ\\nsjflajf", "referencias": [{"uid": "rc-upload-1771245330623-9", "name": "CV_Andres_Perez_Espanol.pdf", "size": 112468, "status": "done", "originFileObj": {"uid": "rc-upload-1771245330623-9"}}], "forma_entrega": "movil", "restricciones": ["jfeopaf"], "tipo_descripcion": "jfklfjl", "usuarios_finales": ["jfñfj", "jfejfl", "jeiofjoe"], "descripcion_ideal": "fjlksjafljsflaj", "tiene_restricciones": true, "funcionalidades_minimas": ["feje", "iojaefoj", "jeifojoa"], "funcionalidades_deseables": ["jefljaleflñ"]}, "usuario_creador_id": 5, "descripcion_problema": {"origen": "jfsjf", "evidencia": [{"uid": "rc-upload-1771245330623-7", "name": "CV_Andres_Perez_English.pdf", "size": 112850, "status": "done", "originFileObj": {"uid": "rc-upload-1771245330623-7"}}], "fecha_inicio": "2026-02-14T05:00:00.000Z", "impacto_nivel": "critica", "situacion_actual": "djklfjl", "impacto_descripcion": "jflkafjl", "afectacion_operacion": "jflkjfl", "procesos_comprometidos": "jflksfl"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	5	::ffff:192.168.0.7	2026-02-16 12:40:19.38029
13	solicitud	8	crear	\N	{"id": 8, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0008", "estado": "pendiente_evaluacion_nt", "titulo": "Fallo: jfjoeinamfñmpoeajmfñmañfmeopf...", "creado_en": "2026-02-16T12:41:59.807Z", "prioridad": "critica", "beneficios": {}, "resolucion": null, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-16T12:41:59.807Z", "motivo_rechazo": null, "solicitante_id": null, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "nuevas_tecnologias", "cargo": "nt", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andres Perez", "operacion_contrato": "contrato_gran_tierra"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {"urgencia": "critica", "justificacion": "jfoejajfpa"}, "solucion_propuesta": {}, "usuario_creador_id": 5, "descripcion_problema": {"descripcion": "jfjoeinamfñmpoeajmfñmañfmeopf"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	5	::ffff:192.168.0.7	2026-02-16 12:41:59.8417
14	solicitud	9	crear	\N	{"id": 9, "kpis": [], "tipo": "cierre_servicio", "codigo": "SOL-2026-0009", "estado": "pendiente_evaluacion_nt", "titulo": "Cierre: nflejnalfl\\nnfleanlfnla...", "creado_en": "2026-02-16T12:44:31.077Z", "prioridad": "media", "beneficios": {}, "resolucion": null, "declaracion": {"confirmacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-16T12:44:31.077Z", "motivo_rechazo": null, "solicitante_id": null, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "ti", "cargo": "hspofjjpejfpoeopjf", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "jesus cotes", "operacion_contrato": "contrato_oxy"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {}, "solucion_propuesta": {}, "usuario_creador_id": 5, "descripcion_problema": {"descripcion": "nflejnalfl\\nnfleanlfnla"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	5	::ffff:192.168.0.7	2026-02-16 12:44:31.113688
15	ticket	7	transferencia	{"estado": "abierto"}	{"estado": "transferido_nt", "solicitud_id": 10, "solicitud_codigo": "SOL-202602-0010"}	9	\N	2026-02-16 12:45:30.666322
16	ticket	8	cambio_estado	{"estado": "abierto"}	{"estado": "en_proceso"}	9	\N	2026-02-16 12:48:28.935531
17	solicitud	10	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "descartado_nt", "comentario": "Solicitud descartada por NT"}	5	\N	2026-02-16 12:49:13.913069
18	solicitud	9	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_proceso", "comentario": "Tomando solicitud"}	5	\N	2026-02-16 12:49:21.248383
19	solicitud	9	cambio_estado	{"estado": "en_proceso"}	{"estado": "pendiente_evaluacion_nt", "comentario": "Devuelto a pendiente"}	5	\N	2026-02-16 12:49:24.124696
20	solicitud	9	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "descartado_nt", "comentario": "Solicitud descartada por NT"}	5	\N	2026-02-16 12:49:26.87944
21	solicitud	8	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_proceso", "comentario": "Tomando solicitud"}	5	\N	2026-02-16 12:49:33.946324
22	solicitud	8	cambio_estado	{"estado": "en_proceso"}	{"estado": "no_realizado", "comentario": "Solicitud no realizada"}	5	\N	2026-02-16 12:49:37.687172
23	solicitud	7	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-16 12:49:50.660144
24	ticket	8	cambio_estado	{"estado": "en_proceso"}	{"estado": "solucionado"}	3	\N	2026-02-16 13:03:05.991397
25	ticket	8	transferencia	{"estado": "abierto"}	{"estado": "transferido_nt", "solicitud_id": 11, "solicitud_codigo": "SOL-202602-0011"}	3	\N	2026-02-16 13:04:41.754079
26	solicitud	7	cambio_estado	{"estado": "pendiente_aprobacion_gerencia"}	{"estado": "aprobado"}	4	\N	2026-02-16 13:07:25.636339
27	solicitud	7	agendar	{"estado": "aprobado"}	{"estado": "agendado", "fecha_fin_programada": "2026-04-15T00:00:00.000Z", "fecha_inicio_programada": "2026-03-01T00:00:00.000Z"}	4	\N	2026-02-16 13:09:10.310785
28	solicitud	7	solicitar_reevaluacion	{"estado": "pendiente_aprobacion_gerencia"}	{"estado": "pendiente_reevaluacion", "comentario": "Necesita más detalles en el cronograma", "areas_revisar": ["cronograma", "costos"]}	4	\N	2026-02-16 13:10:53.471753
29	solicitud	11	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "descartado_nt", "comentario": "Solicitud descartada por NT"}	5	\N	2026-02-16 13:12:30.68685
30	solicitud	6	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-16 13:12:45.889794
31	solicitud	6	enviar_a_gerencia	\N	{"evaluacion_id": "3"}	5	\N	2026-02-16 13:13:40.732087
32	ticket	8	cambio_estado	{"estado": "abierto"}	{"estado": "en_proceso"}	3	\N	2026-02-16 13:49:45.810898
33	solicitud	6	solicitar_reevaluacion	{"estado": "pendiente_aprobacion_gerencia"}	{"estado": "pendiente_reevaluacion", "comentario": "jj", "areas_revisar": ["cronograma"]}	6	\N	2026-02-16 14:01:06.055148
34	solicitud	5	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_proceso", "comentario": "Tomando solicitud"}	7	\N	2026-02-16 14:52:50.580788
35	ticket	9	cambio_estado	{"estado": "abierto"}	{"estado": "en_proceso"}	9	\N	2026-02-16 16:28:23.718035
36	ticket	9	cambio_estado	{"estado": "en_proceso"}	{"estado": "abierto"}	9	\N	2026-02-16 16:28:41.807449
37	ticket	9	cambio_estado	{"estado": "abierto"}	{"estado": "en_proceso"}	9	\N	2026-02-16 16:28:46.289307
38	solicitud	5	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "completado", "comentario": "Solicitud completada"}	5	\N	2026-02-16 17:06:04.934847
39	solicitud	6	cambio_estado	{"estado": "pendiente_reevaluacion"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-16 17:06:15.754307
40	solicitud	7	cambio_estado	{"estado": "pendiente_reevaluacion"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-17 16:53:47.088965
41	solicitud	12	crear	\N	{"id": 12, "kpis": [{"nombre": "tiempo", "unidad": "a", "valor_actual": "a", "valor_objetivo": "a"}], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0012", "estado": "pendiente_evaluacion_nt", "titulo": "Proyecto: aa...", "creado_en": "2026-02-17T17:55:07.555Z", "prioridad": "critica", "beneficios": {"descripcion": "aaa", "mejora_concreta": "aaa", "reduccion_costos": true, "costos_descripcion": "aa", "procesos_optimizados": ["aa"]}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-17T17:55:07.555Z", "motivo_rechazo": null, "solicitante_id": 1, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "aaa", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "aaaa", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {"areas": ["a"], "personas": ["a"]}, "aplica_externas": false}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "inmediata", "fecha_limite": "2026-05-07T05:00:00.000Z", "justificacion_nt": "aaa", "necesidad_principal": "aaa"}, "solucion_propuesta": {"tipo": "integracion", "descripcion_ideal": "aaa", "funcionalidades_minimas": ["a"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "aaa", "fecha_inicio": "2026-02-01T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "aa", "impacto_descripcion": "aaa", "afectacion_operacion": "aaa", "procesos_comprometidos": "aaa"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:192.168.0.12	2026-02-17 17:55:07.576834
42	solicitud	12	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-17 17:56:15.97197
43	solicitud	13	crear	\N	{"id": 13, "kpis": [{"nombre": "Numero de procedimientos en formato de inemec sobre total", "unidad": "%", "valor_actual": "0", "valor_objetivo": "100"}], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0013", "estado": "pendiente_evaluacion_nt", "titulo": "Proyecto: Para Disciplina Operativa , se necesita realizar e...", "creado_en": "2026-02-17T18:24:30.348Z", "prioridad": "media", "beneficios": {"descripcion": "Cumplimiento contractual", "mejora_concreta": "Estandarización de formatos. A corto tiempo, traslado amplio de la información.", "reduccion_costos": true, "costos_descripcion": "Es un requerimiento contractual. El realizarlo con NT reduce los costos comparado por medios tradicionales."}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-17T18:24:30.348Z", "motivo_rechazo": null, "solicitante_id": 17, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "administracion", "cargo": "Gerente de Cuentas y Proyectos", "cedula": "80212566", "correo": "gte.comercial@inemec.com", "telefono": "3176698712", "es_doliente": true, "nombre_completo": "Gabriel Fernando Cordoba", "operacion_contrato": "otro"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {"areas": ["HSE", "Administración"], "personas": ["Jennifer Sanguino", "Samuel Ronderos", "Omar Quiñones"]}, "aplica_externas": false}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "mediano_plazo", "fecha_limite": "2026-04-17T05:00:00.000Z", "justificacion_nt": "Por el uso de IA para ser mas eficientes en el traslado de la informacion", "necesidad_principal": "Procesar los procedimientos actuales (SierraCol ENergy) y pasarlos a formato INEMEC con las condiciones/premisas que contiene dicho formato"}, "solucion_propuesta": {"tipo": "automatizacion", "casos_uso": "Caso 1: Dar continuidad de disciplina operativa\\nCaso 2: Cumplimiento contractual", "forma_entrega": "api", "tipo_descripcion": "Similar a un procedimiento previo realizado en GGS", "descripcion_ideal": "La documentación 250 procedimientos de SierraCol en formatos y con los puntos claves de Inemec", "tiene_restricciones": false, "funcionalidades_minimas": ["Cambio de formato de la documentación"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "El origen del problema es que de acuerdo al programa de Disciplina Operativa de SierraCol Energy, ahora los procedimientos deben de ser directamente del ejuecutante y no de la operadora. Adicional tambien se esta implementando el programa de seguridad de procesos de INEMEC", "fecha_inicio": "2025-12-01T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "Para Disciplina Operativa , se necesita realizar el traslado de procedimientos desde SierraCol Energy a INEMEC, por ende, para tener eficiencia en el traslado de los 250 procedimientos, se requiere  ayuda de la IA", "impacto_descripcion": "El no cumplimineto de los procedimientos del cliente para la ejecucion de trabajos impacta en penalidades generadas al contrato CW2261100", "afectacion_operacion": "En la ejecucion y en el cumplimiento de procedimientos de SierraCol Energy", "procesos_comprometidos": "Seguridad de procesos (Disciplina Operativa),. HSE, Administracion"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:192.168.0.12	2026-02-17 18:24:30.377967
44	solicitud	13	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-17 18:28:55.574355
45	ticket	21	cambio_estado	{"estado": "abierto"}	{"estado": "en_proceso"}	9	\N	2026-02-19 20:23:39.058822
46	ticket	21	cambio_estado	{"estado": "en_proceso"}	{"estado": "solucionado"}	9	\N	2026-02-19 20:25:22.153971
47	solicitud	6	enviar_a_gerencia	\N	{"evaluacion_id": "3"}	5	\N	2026-02-20 02:00:18.530993
48	solicitud	14	crear	\N	{"id": 14, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0014", "estado": "pendiente_evaluacion_nt", "titulo": "Error en sistema de facturacion", "creado_en": "2026-02-20T03:25:47.057Z", "prioridad": "alta", "beneficios": {}, "resolucion": null, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:25:47.057Z", "motivo_rechazo": null, "solicitante_id": 24, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Finanzas", "cargo": "Contadora", "cedula": "87654321", "correo": "test@inemec.com", "telefono": "3009876543", "es_doliente": true, "nombre_completo": "Maria Garcia Test", "operacion_contrato": "INEMEC Corporativo"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {"urgencia": "alta", "justificacion": "Necesitamos el reporte para la reunion con gerencia manana"}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Error en sistema de facturacion al generar reportes mensuales", "descripcion": "Al intentar generar el reporte mensual de enero, el sistema muestra error 500. El problema ocurre cuando hay mas de 1000 facturas en el periodo."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:25:47.079041
49	solicitud	15	crear	\N	{"id": 15, "kpis": [], "tipo": "cierre_servicio", "codigo": "SOL-2026-0015", "estado": "pendiente_evaluacion_nt", "titulo": "Cierre del sistema legacy de inventarios", "creado_en": "2026-02-20T03:26:18.533Z", "prioridad": "media", "beneficios": {}, "resolucion": null, "declaracion": {"confirmacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:26:18.533Z", "motivo_rechazo": null, "solicitante_id": 24, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Operaciones", "cargo": "Analista de Procesos", "cedula": "11223344", "correo": "test@inemec.com", "telefono": "3001112233", "es_doliente": false, "nombre_completo": "Carlos Rodriguez Test", "operacion_contrato": "INEMEC Corporativo"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Cierre del sistema legacy de inventarios", "descripcion": "El sistema de inventarios legacy fue reemplazado por SAP. Ya no hay usuarios activos desde hace 6 meses. Todos los datos fueron migrados exitosamente."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:26:18.543985
50	solicitud	16	crear	\N	{"id": 16, "kpis": [], "tipo": "cierre_servicio", "codigo": "SOL-2026-0016", "estado": "pendiente_evaluacion_nt", "titulo": "Cierre de portal de reportes antiguo", "creado_en": "2026-02-20T03:26:34.969Z", "prioridad": "baja", "beneficios": {}, "resolucion": null, "declaracion": {"confirmacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:26:34.969Z", "motivo_rechazo": null, "solicitante_id": 24, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Tecnologia", "cargo": "Jefe de Proyectos", "cedula": "22334455", "correo": "test@inemec.com", "telefono": "3002223344", "es_doliente": true, "nombre_completo": "Sofia Lopez Test", "operacion_contrato": "INEMEC Corporativo"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Cierre de portal de reportes antiguo", "descripcion": "El portal de reportes fue reemplazado por PowerBI. Ya no tiene usuarios activos y los costos de mantenimiento son innecesarios."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:26:34.976502
51	solicitud	17	crear	\N	{"id": 17, "kpis": [{"nombre": "Contratos vencidos sin renovar", "valor_actual": "15%", "valor_objetivo": "0%"}, {"nombre": "Tiempo de busqueda de contrato", "valor_actual": "30 min", "valor_objetivo": "2 min"}], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0017", "estado": "pendiente_evaluacion_nt", "titulo": "Sistema de gestion de contratos", "creado_en": "2026-02-20T03:28:10.624Z", "prioridad": "alta", "beneficios": {"descripcion": "Reduccion de riesgo legal, mejor control de vencimientos, reportes automatizados", "mejora_concreta": "Eliminacion de renovaciones perdidas y multas por incumplimiento", "reduccion_costos": true, "reduccion_costos_descripcion": "Ahorro estimado de 50M COP anuales en multas evitadas"}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:28:10.624Z", "motivo_rechazo": null, "solicitante_id": 26, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Legal", "cargo": "Analista Legal", "cedula": "33445566", "correo": "test2@inemec.com", "telefono": "3003334455", "es_doliente": false, "nombre_completo": "Roberto Mendez Test", "operacion_contrato": "INEMEC Corporativo"}, "datos_patrocinador": {"area": "Legal", "cargo": "Directora Legal", "cedula": "99887766", "correo": "sponsor.legal@inemec.com", "nombre_completo": "Patricia Ruiz Sponsor", "operacion_contrato": "INEMEC Corporativo"}, "datos_stakeholders": {"externas": {"empresas": ["Proveedores principales"], "personas": ["Representantes legales"], "sectores": ["Proveedores", "Clientes"]}, "internas": {"areas": ["Legal", "Finanzas", "Operaciones"], "personas": ["Gerente Legal", "Contador Principal"]}, "aplica_externas": true}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "corto_plazo", "justificacion_nt": "Tenemos auditorias programadas en 2 meses y necesitamos orden en los contratos", "necesidad_principal": "Centralizar y automatizar el seguimiento de contratos"}, "solucion_propuesta": {"funcionalidades_minimas": ["Registro de contratos", "Alertas de vencimiento", "Dashboard de estado", "Busqueda avanzada"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "Crecimiento de la empresa y aumento de contratos ha hecho inmanejable el proceso manual.", "titulo": "Sistema de gestion de contratos", "impacto_nivel": "alta", "situacion_actual": "Actualmente los contratos se manejan en carpetas fisicas y archivos Excel. Es dificil hacer seguimiento a vencimientos.", "impacto_descripcion": "Riesgo de multas por incumplimiento de contratos y perdida de clientes importantes", "afectacion_operacion": "Se han perdido oportunidades de renovacion por falta de seguimiento. Riesgo legal.", "procesos_comprometidos": "Renovaciones, auditorias, reportes gerenciales, cumplimiento legal"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:28:10.634277
52	solicitud	18	crear	\N	{"id": 18, "kpis": [{"nombre": "Tiempo promedio de reporte", "valor_actual": "3 dias", "valor_objetivo": "30 min"}], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0018", "estado": "pendiente_evaluacion_nt", "titulo": "App movil para reportes de campo", "creado_en": "2026-02-20T03:28:32.652Z", "prioridad": "media", "beneficios": {"descripcion": "Informacion en tiempo real, menos errores de digitacion, mejor trazabilidad", "mejora_concreta": "Reduccion del tiempo de reporte de 3 dias a tiempo real", "reduccion_costos": false}, "resolucion": null, "declaracion": {"confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:28:32.652Z", "motivo_rechazo": null, "solicitante_id": 26, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Operaciones", "cargo": "Gerente de Operaciones", "cedula": "44556677", "correo": "test2@inemec.com", "telefono": "3004445566", "es_doliente": true, "nombre_completo": "Fernando Castro Test", "operacion_contrato": "INEMEC Corporativo"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {"areas": ["Operaciones", "Tecnologia"], "personas": ["Supervisores de campo", "Coordinadores"]}, "aplica_externas": false}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "mediano_plazo", "justificacion_nt": "Podemos esperar pero entre mas pronto mejor para la eficiencia", "necesidad_principal": "Digitalizar los reportes de campo con app movil"}, "solucion_propuesta": {"funcionalidades_minimas": ["Formularios offline", "Captura de fotos", "GPS", "Sincronizacion automatica"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "Proceso manual anticuado que no escala con el crecimiento del equipo de campo.", "titulo": "App movil para reportes de campo", "impacto_nivel": "media", "situacion_actual": "Los reportes de campo se hacen en papel y luego se digitan. Hay errores y demoras.", "impacto_descripcion": "Ineficiencia operativa y toma de decisiones con informacion desactualizada", "afectacion_operacion": "Demoras de hasta 3 dias en tener informacion actualizada de campo.", "procesos_comprometidos": "Reportes diarios, seguimiento de tareas, control de calidad"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:28:32.659784
73	ticket	27	transferencia	{"estado": "abierto"}	{"estado": "transferido_nt", "solicitud_id": 36, "solicitud_codigo": "SOL-202602-0036"}	9	\N	2026-02-20 06:53:26.769669
53	solicitud	19	crear	\N	{"id": 19, "kpis": [{"nombre": "Cumplimiento normativo", "valor_actual": "70%", "valor_objetivo": "100%"}], "tipo": "actualizacion", "codigo": "SOL-2026-0019", "estado": "pendiente_evaluacion_nt", "titulo": "Mejoras al sistema de facturacion", "creado_en": "2026-02-20T03:28:56.497Z", "prioridad": "alta", "beneficios": {"descripcion": "Cumplimiento regulatorio y evitar multas", "mejora_concreta": "Cumplimiento del 100% con regulacion DIAN 2026", "reduccion_costos": true, "reduccion_costos_descripcion": "Evitar multas de hasta 500M COP"}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:28:56.497Z", "motivo_rechazo": null, "solicitante_id": 26, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Finanzas", "cargo": "Analista Financiero", "cedula": "55667788", "correo": "test2@inemec.com", "telefono": "3005556677", "es_doliente": false, "nombre_completo": "Diana Vargas Test", "operacion_contrato": "INEMEC Corporativo"}, "datos_patrocinador": {"area": "Finanzas", "cargo": "Director Financiero", "cedula": "11223399", "correo": "director.fin@inemec.com", "nombre_completo": "Ricardo Gomez Sponsor", "operacion_contrato": "INEMEC Corporativo"}, "datos_stakeholders": {"externas": {"sectores": ["Clientes", "DIAN"]}, "internas": {"areas": ["Finanzas", "Contabilidad", "Ventas"]}, "aplica_externas": true}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "inmediata", "fecha_limite": "2026-07-01T00:00:00.000Z", "justificacion_nt": "Fecha limite regulatoria es julio 2026, necesitamos tiempo para pruebas", "necesidad_principal": "Actualizar sistema para cumplir nueva normativa DIAN"}, "solucion_propuesta": {"funcionalidades_minimas": ["Nuevo formato XML DIAN", "Firma electronica actualizada", "Reportes de validacion"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "Cambios en regulacion tributaria colombiana.", "titulo": "Mejoras al sistema de facturacion", "impacto_nivel": "critica", "situacion_actual": "El sistema actual no soporta las nuevas regulaciones de la DIAN para 2026.", "impacto_descripcion": "Multas de hasta 500M COP si no cumplimos antes de julio 2026", "afectacion_operacion": "Riesgo de multas si no cumplimos con la nueva normativa.", "procesos_comprometidos": "Facturacion electronica, reportes a la DIAN, contabilidad"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:28:56.505351
54	solicitud	20	crear	\N	{"id": 20, "kpis": [{"nombre": "Inventario obsoleto", "valor_actual": "15%", "valor_objetivo": "5%"}], "tipo": "actualizacion", "codigo": "SOL-2026-0020", "estado": "pendiente_evaluacion_nt", "titulo": "Nuevos reportes para sistema de inventarios", "creado_en": "2026-02-20T03:29:59.111Z", "prioridad": "media", "beneficios": {"descripcion": "Mejor toma de decisiones en compras", "mejora_concreta": "Reduccion de inventario obsoleto en 20%"}, "resolucion": null, "declaracion": {"confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:29:59.111Z", "motivo_rechazo": null, "solicitante_id": 26, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Logistica", "cargo": "Jefe de Almacen", "cedula": "66778899", "correo": "test2@inemec.com", "telefono": "3006667788", "es_doliente": true, "nombre_completo": "Andres Moreno Test", "operacion_contrato": "Ecopetrol"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {"areas": ["Logistica", "Compras"]}, "aplica_externas": false}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "mediano_plazo", "justificacion_nt": "Mejora operativa que puede esperar pero es importante", "necesidad_principal": "Agregar reportes de rotacion y analisis ABC"}, "solucion_propuesta": {"funcionalidades_minimas": ["Reporte de rotacion", "Analisis ABC", "Dashboard de KPIs"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "Necesidad de mejor analisis para optimizar compras.", "titulo": "Nuevos reportes para sistema de inventarios", "impacto_nivel": "media", "situacion_actual": "Los reportes actuales no muestran informacion de rotacion de inventario por categoria.", "impacto_descripcion": "Sobrecostos por inventario excesivo o faltantes", "afectacion_operacion": "Decisiones de compra suboptimas por falta de informacion detallada.", "procesos_comprometidos": "Analisis de inventario, planificacion de compras"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:29:59.123686
55	solicitud	21	crear	\N	{"id": 21, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0021", "estado": "pendiente_evaluacion_nt", "titulo": "Falla de conectividad en sede norte", "creado_en": "2026-02-20T03:30:24.810Z", "prioridad": "critica", "beneficios": {}, "resolucion": null, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:30:24.810Z", "motivo_rechazo": null, "solicitante_id": 26, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Operaciones", "cargo": "Coordinador de Sede", "cedula": "88888888", "correo": "test2@inemec.com", "es_doliente": true, "nombre_completo": "Coordinador Sede Norte", "operacion_contrato": "Ecopetrol"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {"urgencia": "critica", "justificacion": "50 personas sin poder trabajar, operaciones detenidas en sede norte"}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Falla de conectividad en sede norte", "descripcion": "Desde las 8am no hay conexion a internet ni a la red corporativa en toda la sede norte. Afecta a 50 usuarios."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:30:24.821862
56	solicitud	22	crear	\N	{"id": 22, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0022", "estado": "pendiente_evaluacion_nt", "titulo": "VERIFY: Error de nomina", "creado_en": "2026-02-20T03:45:25.570Z", "prioridad": "critica", "beneficios": {}, "resolucion": null, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:45:25.570Z", "motivo_rechazo": null, "solicitante_id": 30, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "RRHH", "cargo": "Analista", "cedula": "45678901", "correo": "ana@inemec.com", "es_doliente": true, "nombre_completo": "Ana Perez", "operacion_contrato": "INEMEC"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {"urgencia": "critica", "justificacion": "Nomina debe pagarse pronto"}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Error de nomina SAP", "descripcion": "Error NM-4520 bloquea calculo de prenomina en SAP."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:45:25.60217
57	solicitud	23	crear	\N	{"id": 23, "kpis": [], "tipo": "cierre_servicio", "codigo": "SOL-2026-0023", "estado": "pendiente_evaluacion_nt", "titulo": "VERIFY: Cierre de servidor FILESRV01", "creado_en": "2026-02-20T03:45:56.874Z", "prioridad": "baja", "beneficios": {}, "resolucion": null, "declaracion": {"confirmacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:45:56.874Z", "motivo_rechazo": null, "solicitante_id": 30, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "TI", "cargo": "Admin Infraestructura", "cedula": "56789012", "correo": "carlos@inemec.com", "es_doliente": true, "nombre_completo": "Carlos Martinez", "operacion_contrato": "INEMEC"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Cierre de servidor FILESRV01", "descripcion": "Servidor Windows 2012 sin usuarios activos. Datos migrados a SharePoint. Genera costos innecesarios."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:45:56.893037
74	solicitud	29	transferencia	{"estado": "pendiente_evaluacion_nt"}	{"estado": "transferido_ti", "ticket_id": 30, "ticket_codigo": "TKT-202602-0025"}	5	\N	2026-02-20 07:24:08.97713
58	solicitud	24	crear	\N	{"id": 24, "kpis": [], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0024", "estado": "pendiente_evaluacion_nt", "titulo": "VERIFY: Portal de autoservicio empleados", "creado_en": "2026-02-20T03:45:56.926Z", "prioridad": "media", "beneficios": {"descripcion": "Autoservicio 24/7", "mejora_concreta": "De 200 a 40 consultas mensuales", "reduccion_costos": true}, "resolucion": null, "declaracion": {"confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:45:56.926Z", "motivo_rechazo": null, "solicitante_id": 30, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Gestion Humana", "cargo": "Gerente GH", "cedula": "67890123", "correo": "diana@inemec.com", "es_doliente": true, "nombre_completo": "Diana Rojas", "operacion_contrato": "INEMEC"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {"areas": ["GH", "Nomina", "TI"], "personas": ["Coordinadores", "Analistas"]}, "aplica_externas": false}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "mediano_plazo", "justificacion_nt": "Implementar Q2 2026", "necesidad_principal": "Reducir carga operativa RRHH"}, "solucion_propuesta": {"funcionalidades_minimas": ["Login AD", "Consulta vacaciones", "Descarga certificados"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "Carga administrativa excesiva", "titulo": "Portal autoservicio empleados", "impacto_nivel": "alta", "situacion_actual": "200+ consultas mensuales a RRHH", "impacto_descripcion": "Tiempo respuesta 3-5 dias", "afectacion_operacion": "Personal no puede enfocarse en tareas estrategicas", "procesos_comprometidos": "Certificados, vacaciones, nomina"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:45:56.933366
59	solicitud	25	crear	\N	{"id": 25, "kpis": [], "tipo": "actualizacion", "codigo": "SOL-2026-0025", "estado": "pendiente_evaluacion_nt", "titulo": "VERIFY: Modulo trazabilidad ERP", "creado_en": "2026-02-20T03:46:32.494Z", "prioridad": "alta", "beneficios": {"descripcion": "Cumplimiento ISO 22000", "mejora_concreta": "Rastreo de 2-3 dias a 5 minutos", "reduccion_costos": false}, "resolucion": null, "declaracion": {"confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T03:46:32.494Z", "motivo_rechazo": null, "solicitante_id": 30, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Produccion", "cargo": "Jefe Produccion", "cedula": "78901234", "correo": "fernando@inemec.com", "es_doliente": false, "nombre_completo": "Fernando Castro", "operacion_contrato": "INEMEC Planta 1"}, "datos_patrocinador": {"area": "Operaciones", "cargo": "Directora Operaciones", "cedula": "23456789", "correo": "margarita@inemec.com", "nombre_completo": "Margarita Lopez", "operacion_contrato": "INEMEC"}, "datos_stakeholders": {"externas": {"empresas": ["Cliente principal"], "personas": ["Auditores externos"], "sectores": ["Industrial"]}, "internas": {"areas": ["Produccion", "Calidad"], "personas": ["Supervisores", "Inspectores"]}, "aplica_externas": true}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "corto_plazo", "justificacion_nt": "Auditoria abril 2026", "necesidad_principal": "Cumplir requisitos trazabilidad ISO"}, "solucion_propuesta": {"funcionalidades_minimas": ["Registro lotes", "Trazabilidad produccion", "Reporte recall"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "Requerimiento clientes ISO", "titulo": "Modulo trazabilidad ERP", "impacto_nivel": "critica", "situacion_actual": "Trazabilidad en Excel, toma 2-3 dias", "impacto_descripcion": "Riesgo perder clientes", "afectacion_operacion": "Auditorias fallidas", "procesos_comprometidos": "Rastreo lotes, reclamos, auditorias"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 03:46:32.511168
60	solicitud	26	crear	\N	{"id": 26, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0026", "estado": "pendiente_evaluacion_nt", "titulo": "FILETEST: Error con archivos adjuntos", "creado_en": "2026-02-20T04:10:02.960Z", "prioridad": "alta", "beneficios": {}, "resolucion": null, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-20T04:10:02.960Z", "motivo_rechazo": null, "solicitante_id": 30, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "Calidad", "cargo": "QA Engineer", "cedula": "99999999", "correo": "tester@inemec.com", "es_doliente": true, "nombre_completo": "Tester Archivos", "operacion_contrato": "INEMEC"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {"urgencia": "alta", "justificacion": "Prueba de funcionalidad de archivos"}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "Error con archivos adjuntos", "descripcion": "Prueba de carga de archivos al sistema. Adjunto evidencias del error."}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:172.26.0.1	2026-02-20 04:10:03.012864
61	solicitud	27	crear	\N	{"id": 27, "kpis": [], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0027", "estado": "pendiente_evaluacion_nt", "titulo": "giuhonlm", "creado_en": "2026-02-20T04:34:27.047Z", "prioridad": "alta", "beneficios": {"descripcion": "bnlkm ", "analisis_costos": {"costos_actuales": [{"valor": 10000, "cantidad": 1, "descripcion": "6789"}], "costos_esperados": [{"valor": 5000, "cantidad": 1, "descripcion": "19900"}]}, "mejora_concreta": "gyuihojnmp", "reduccion_costos": true, "beneficio_monetario": {"items": [{"valor": 10000, "cantidad": 1, "descripcion": "fjkhuionm"}], "justificacion": "bnlkm", "espera_beneficio": true}}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T04:34:27.047Z", "motivo_rechazo": null, "solicitante_id": 32, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "bnjlkm", "cedula": "567865", "correo": "ugyhinom@inemec.com", "es_doliente": true, "nombre_completo": "ubinlmk", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {}}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "corto_plazo", "fecha_limite": "2026-02-21T05:00:00.000Z", "justificacion_nt": "giuhnolmñ", "necesidad_principal": "giuhoinm"}, "solucion_propuesta": {"funcionalidades_minimas": ["iuhnomñ"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "iuhnlkm", "titulo": "giuhonlm", "evidencia": [{"uid": "rc-upload-1771561546450-4", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771561546450-4"}}], "fecha_inicio": "2026-02-19T05:00:00.000Z", "impacto_nivel": "baja", "situacion_actual": "iuhnolmkñ", "impacto_descripcion": "ihuojnmñ", "afectacion_operacion": "giuhonlmñ", "procesos_comprometidos": "iunlkmñ"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:192.168.0.12	2026-02-20 04:34:27.078525
68	solicitud	33	crear	\N	{"id": 33, "kpis": [], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0033", "estado": "pendiente_evaluacion_nt", "titulo": "jfpokeajf", "creado_en": "2026-02-20T05:13:42.370Z", "prioridad": "critica", "beneficios": {"descripcion": "uybinomiuhojp", "mejora_concreta": "hiuojp", "beneficio_monetario": {}}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T05:13:42.370Z", "motivo_rechazo": null, "solicitante_id": null, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "efmlf", "cedula": "380", "correo": "fmepfk@i.co", "es_doliente": true, "nombre_completo": "fjpkeof", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {}}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "inmediata", "justificacion_nt": "eofjipka", "necesidad_principal": "ehfoijpkae"}, "solucion_propuesta": {"tipo": "aplicacion_movil", "referencias": [{"uid": "rc-upload-1771564326330-6", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771564326330-6"}}], "funcionalidades_minimas": ["efnlm"]}, "usuario_creador_id": 5, "descripcion_problema": {"origen": "fempao,f", "titulo": "jfpokeajf", "evidencia": [{"uid": "rc-upload-1771564326330-4", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771564326330-4"}}], "impacto_nivel": "media", "situacion_actual": "jfaepkof", "impacto_descripcion": "fejoikpaf", "afectacion_operacion": "jfokpe", "procesos_comprometidos": "joefpkaf"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	5	::ffff:192.168.0.12	2026-02-20 05:13:42.397312
62	solicitud	28	crear	\N	{"id": 28, "kpis": [], "tipo": "actualizacion", "codigo": "SOL-2026-0028", "estado": "pendiente_evaluacion_nt", "titulo": "uhinl", "creado_en": "2026-02-20T04:45:04.756Z", "prioridad": "critica", "beneficios": {"descripcion": "ibunolm", "analisis_costos": {"costos_actuales": [{"valor": 5678000, "cantidad": 1, "descripcion": "2849"}], "costos_esperados": [{"valor": 569000, "cantidad": 1, "descripcion": "ejk"}]}, "mejora_concreta": "binjlkm", "reduccion_costos": true, "beneficio_monetario": {"items": [{"valor": 10000000, "cantidad": 1, "descripcion": "hifl"}], "justificacion": "fhjkmeñ", "espera_beneficio": true}}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T04:45:04.756Z", "motivo_rechazo": null, "solicitante_id": 36, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "operaciones", "cargo": "nklm", "cedula": "1005257395", "correo": "dodke@inemec.com", "es_doliente": true, "nombre_completo": "inml", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {}}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "inmediata", "justificacion_nt": "guyibhunom", "necesidad_principal": "uybinml"}, "solucion_propuesta": {"funcionalidades_minimas": ["uybinom"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "inlm", "titulo": "uhinl", "impacto_nivel": "baja", "situacion_actual": "ihunlm", "impacto_descripcion": "ubyinlm", "afectacion_operacion": "iubhnlm", "procesos_comprometidos": "inlkm"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:192.168.0.12	2026-02-20 04:45:04.785624
63	solicitud	29	crear	\N	{"id": 29, "kpis": [], "tipo": "reporte_fallo", "codigo": "SOL-2026-0029", "estado": "pendiente_evaluacion_nt", "titulo": "uyhio", "creado_en": "2026-02-20T04:48:05.969Z", "prioridad": "critica", "beneficios": {}, "resolucion": null, "declaracion": {}, "evaluador_id": null, "actualizado_en": "2026-02-20T04:48:05.969Z", "motivo_rechazo": null, "solicitante_id": 38, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "binlm", "cedula": "1005257395", "correo": "buinom@inemec.com", "es_doliente": true, "nombre_completo": "uybinom", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {}, "datos_stakeholders": {}, "fecha_fin_estimada": null, "necesidad_urgencia": {"urgencia": "critica", "justificacion": "fgihuoijpmo"}, "solucion_propuesta": {}, "usuario_creador_id": null, "descripcion_problema": {"titulo": "uyhio", "descripcion": "ubyinombinomkklkibhoio"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:192.168.0.12	2026-02-20 04:48:05.996982
64	solicitud	30	crear	\N	{"id": 30, "kpis": [], "tipo": "proyecto_nuevo_interno", "codigo": "SOL-2026-0030", "estado": "pendiente_evaluacion_nt", "titulo": "yughinom", "creado_en": "2026-02-20T04:49:55.537Z", "prioridad": "baja", "beneficios": {"descripcion": "lkmnjibuyvtc", "mejora_concreta": "mlknibuyvt", "beneficio_monetario": {}}, "resolucion": null, "declaracion": {"confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T04:49:55.537Z", "motivo_rechazo": null, "solicitante_id": 39, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "gerencia_general", "cargo": "uybinom", "cedula": "24879810", "correo": "ihuojkp@inemec.com", "telefono": "5467829", "es_doliente": false, "nombre_completo": "ubinom", "operacion_contrato": "oficina_principal"}, "datos_patrocinador": {"area": "gerencia_general", "cargo": "uihom", "cedula": "7890", "correo": "hiuoj@ineufpf.com", "nombre_completo": "ugyihoni", "operacion_contrato": "planta_barranca"}, "datos_stakeholders": {"internas": {}}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "largo_plazo", "justificacion_nt": "uihojpk", "necesidad_principal": "mkinubyvt"}, "solucion_propuesta": {"funcionalidades_minimas": ["lkmnjbhuvy"]}, "usuario_creador_id": null, "descripcion_problema": {"origen": "ugyihnomp,ubinom", "titulo": "yughinom", "impacto_nivel": "media", "situacion_actual": "ubinom", "impacto_descripcion": "oimnubyvt", "afectacion_operacion": "ubiunomñ,", "procesos_comprometidos": "vuybinom"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	\N	::ffff:192.168.0.12	2026-02-20 04:49:55.57831
65	ticket	29	cambio_estado	{"estado": "abierto"}	{"estado": "en_proceso"}	9	\N	2026-02-20 04:52:22.106656
66	ticket	28	transferencia	{"estado": "abierto"}	{"estado": "transferido_nt", "solicitud_id": 31, "solicitud_codigo": "SOL-202602-0031"}	9	\N	2026-02-20 04:53:25.251267
67	solicitud	32	crear	\N	{"id": 32, "kpis": [], "tipo": "actualizacion", "codigo": "SOL-2026-0032", "estado": "pendiente_evaluacion_nt", "titulo": "jkñ,iojpko", "creado_en": "2026-02-20T05:08:37.930Z", "prioridad": "critica", "beneficios": {"descripcion": "vyubinoml", "mejora_concreta": "vubiunom", "beneficio_monetario": {}}, "resolucion": null, "declaracion": {"acepto_seguimiento": true, "confirmo_informacion": true}, "evaluador_id": null, "actualizado_en": "2026-02-20T05:08:37.930Z", "motivo_rechazo": null, "solicitante_id": null, "fecha_resolucion": null, "origen_ticket_id": null, "datos_solicitante": {"area": "ti", "cargo": "jdoef", "cedula": "8390", "correo": "mfijo@c.com", "es_doliente": true, "nombre_completo": "djpf", "operacion_contrato": "planta_barranca"}, "datos_patrocinador": {}, "datos_stakeholders": {"internas": {}}, "fecha_fin_estimada": null, "necesidad_urgencia": {"nivel": "inmediata", "justificacion_nt": "ftyguhijokp", "necesidad_principal": "ubinomp,"}, "solucion_propuesta": {"referencias": [{"uid": "rc-upload-1771564003266-4", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771564003266-4"}}], "funcionalidades_minimas": ["ubinom"]}, "usuario_creador_id": 5, "descripcion_problema": {"origen": "inomp,", "titulo": "jkñ,iojpko", "impacto_nivel": "critica", "situacion_actual": "iuojmp,´", "impacto_descripcion": "buinomp,", "afectacion_operacion": "bnjmklñ,", "procesos_comprometidos": "buinom,"}, "fecha_fin_programada": null, "reevaluaciones_count": 0, "fecha_inicio_agendada": null, "fecha_inicio_programada": null, "transferido_a_ticket_id": null}	5	::ffff:192.168.0.12	2026-02-20 05:08:37.960545
69	solicitud	32	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-20 06:10:46.182213
70	solicitud	33	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "en_estudio", "comentario": "Iniciando análisis de la solicitud"}	5	\N	2026-02-20 06:21:24.786112
71	ticket	26	transferencia	{"estado": "abierto"}	{"estado": "transferido_nt", "solicitud_id": 34, "solicitud_codigo": "SOL-202602-0034"}	9	\N	2026-02-20 06:28:28.380805
72	ticket	25	transferencia	{"estado": "abierto"}	{"estado": "transferido_nt", "solicitud_id": 35, "solicitud_codigo": "SOL-202602-0035"}	9	\N	2026-02-20 06:28:51.910733
75	solicitud	12	edicion_formulario	{"sponsor": {}, "solucion": {"tipo": "integracion", "descripcion_ideal": "aaa", "funcionalidades_minimas": ["a"]}, "urgencia": {"nivel": "inmediata", "fecha_limite": "2026-05-07T05:00:00.000Z", "justificacion_nt": "aaa", "necesidad_principal": "aaa"}, "desempeno": {"indicadores": [{"nombre": "tiempo", "unidad": "a", "valor_actual": "a", "valor_objetivo": "a"}]}, "beneficios": {"descripcion": "aaa", "mejora_concreta": "aaa", "reduccion_costos": true, "costos_descripcion": "aa", "procesos_optimizados": ["aa"]}, "problematica": {"origen": "aaa", "fecha_inicio": "2026-02-01T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "aa", "impacto_descripcion": "aaa", "afectacion_operacion": "aaa", "procesos_comprometidos": "aaa"}, "stakeholders": {"internas": {"areas": ["a"], "personas": ["a"]}, "aplica_externas": false}, "proyecto_referencia": {}}	{"sponsor": {}, "solucion": {"tipo": "integracion", "descripcion_ideal": "aaa", "funcionalidades_minimas": ["a"]}, "urgencia": {"nivel": "inmediata", "fecha_limite": "2026-05-07T05:00:00.000Z", "justificacion_nt": "aaa", "necesidad_principal": "aaa"}, "desempeno": {"como_medir": "", "indicadores": [{"nombre": "tiempo", "unidad": "a", "valor_actual": "a", "valor_objetivo": "a"}], "herramientas": "", "responsable_datos": "", "compromiso_sponsor": false, "comentarios_adicionales": ""}, "beneficios": {"descripcion": "aaa", "mejora_concreta": "aaa", "reduccion_costos": true, "costos_descripcion": "aa", "procesos_optimizados": ["aa"]}, "problematica": {"origen": "aaa", "fecha_inicio": "2026-02-01T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "aa", "impacto_descripcion": "aaa", "afectacion_operacion": "aaa", "procesos_comprometidos": "aaa"}, "stakeholders": {"internas": {"areas": ["a", "b"], "personas": ["a"]}, "aplica_externas": false}, "proyecto_referencia": {}}	5	\N	2026-02-20 08:38:27.593786
76	solicitud	35	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "completado", "comentario": "Solicitud completada"}	5	\N	2026-02-20 08:58:27.701008
77	solicitud	34	cambio_estado	{"estado": "pendiente_evaluacion_nt"}	{"estado": "completado", "comentario": "Solicitud completada"}	5	\N	2026-02-20 08:58:37.740382
78	solicitud	33	enviar_a_gerencia	\N	{"evaluacion_id": "6"}	5	\N	2026-02-20 09:00:42.036235
79	proyecto	1	cambio_estado	{"estado": "planificacion"}	{"estado": "en_desarrollo"}	5	\N	2026-02-20 10:41:52.113258
80	proyecto	1	cambio_estado	{"estado": "en_desarrollo"}	{"estado": "pausado"}	5	\N	2026-02-20 10:41:58.6321
81	solicitud	33	agendar	{"estado": "pendiente_aprobacion_gerencia"}	{"estado": "agendado", "fecha_fin_programada": "2026-03-30T00:00:00.000Z", "fecha_inicio_programada": "2026-02-20T00:00:00.000Z"}	6	\N	2026-02-20 11:44:36.385487
82	solicitud	6	agendar	{"estado": "pendiente_aprobacion_gerencia"}	{"estado": "agendado", "fecha_fin_programada": "2026-04-29T00:00:00.000Z", "fecha_inicio_programada": "2026-02-23T00:00:00.000Z"}	6	\N	2026-02-20 11:45:32.067664
83	solicitud	32	enviar_a_gerencia	\N	{"evaluacion_id": "7"}	5	\N	2026-02-20 11:47:06.997396
\.


--
-- Data for Name: notificaciones; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.notificaciones (id, usuario_id, tipo, titulo, mensaje, datos, leida, leida_en, creado_en, subtipo) FROM stdin;
2	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0001: Proyecto: test desc...	{"codigo": "SOL-2026-0001", "solicitud_id": 1}	f	\N	2026-02-15 14:53:04.333719	\N
3	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0001: Proyecto: test desc...	{"codigo": "SOL-2026-0001", "solicitud_id": 1}	f	\N	2026-02-15 14:53:04.333719	\N
4	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-202602-0001: Soporte: test descripción 1234...	{"codigo": "TKT-202602-0001", "ticket_id": 1}	f	\N	2026-02-15 14:57:15.108434	\N
6	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0002: Fallo: fallo fallo fallo fallo...	{"codigo": "SOL-2026-0002", "solicitud_id": 2}	f	\N	2026-02-15 15:01:15.337984	\N
7	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0002: Fallo: fallo fallo fallo fallo...	{"codigo": "SOL-2026-0002", "solicitud_id": 2}	f	\N	2026-02-15 15:01:15.337984	\N
9	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0003: Cierre: cierre cierre cierre...	{"codigo": "SOL-2026-0003", "solicitud_id": 3}	f	\N	2026-02-15 15:02:14.716799	\N
10	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0003: Cierre: cierre cierre cierre...	{"codigo": "SOL-2026-0003", "solicitud_id": 3}	f	\N	2026-02-15 15:02:14.716799	\N
12	8	evaluacion_enviada	Nueva evaluación pendiente de aprobación	La solicitud SOL-2026-0001 requiere aprobación de Gerencia	{"solicitud_id": 1, "evaluacion_id": 1, "solicitud_codigo": "SOL-2026-0001"}	f	\N	2026-02-16 03:40:17.14842	\N
13	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-202602-0003: Soporte: test it.              ...	{"codigo": "TKT-202602-0003", "ticket_id": 8}	f	\N	2026-02-16 12:22:15.272606	\N
15	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0006: Proyecto: problema test NT...	{"codigo": "SOL-2026-0006", "solicitud_id": 6}	f	\N	2026-02-16 12:35:16.973628	\N
16	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0006: Proyecto: problema test NT...	{"codigo": "SOL-2026-0006", "solicitud_id": 6}	f	\N	2026-02-16 12:35:16.973628	\N
18	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0007: Actualización: djklfjl...	{"codigo": "SOL-2026-0007", "solicitud_id": 7}	f	\N	2026-02-16 12:40:19.391698	\N
19	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0007: Actualización: djklfjl...	{"codigo": "SOL-2026-0007", "solicitud_id": 7}	f	\N	2026-02-16 12:40:19.391698	\N
21	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0008: Fallo: jfjoeinamfñmpoeajmfñmañfmeopf...	{"codigo": "SOL-2026-0008", "solicitud_id": 8}	f	\N	2026-02-16 12:41:59.850533	\N
22	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0008: Fallo: jfjoeinamfñmpoeajmfñmañfmeopf...	{"codigo": "SOL-2026-0008", "solicitud_id": 8}	f	\N	2026-02-16 12:41:59.850533	\N
24	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0009: Cierre: nflejnalfl\nnfleanlfnla...	{"codigo": "SOL-2026-0009", "solicitud_id": 9}	f	\N	2026-02-16 12:44:31.139948	\N
25	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0009: Cierre: nflejnalfl\nnfleanlfnla...	{"codigo": "SOL-2026-0009", "solicitud_id": 9}	f	\N	2026-02-16 12:44:31.139948	\N
27	7	ticket_transferido	Ticket transferido de TI	El ticket TKT-202602-0002 ha sido transferido como solicitud SOL-202602-0010	{"ticket_id": 7, "solicitud_id": 10, "ticket_codigo": "TKT-202602-0002", "solicitud_codigo": "SOL-202602-0010"}	f	\N	2026-02-16 12:45:30.666322	\N
28	10	ticket_transferido	Ticket transferido de TI	El ticket TKT-202602-0002 ha sido transferido como solicitud SOL-202602-0010	{"ticket_id": 7, "solicitud_id": 10, "ticket_codigo": "TKT-202602-0002", "solicitud_codigo": "SOL-202602-0010"}	f	\N	2026-02-16 12:45:30.666322	\N
30	7	ticket_transferido	Ticket transferido de TI	El ticket TKT-202602-0003 ha sido transferido como solicitud SOL-202602-0011	{"ticket_id": 8, "solicitud_id": 11, "ticket_codigo": "TKT-202602-0003", "solicitud_codigo": "SOL-202602-0011"}	f	\N	2026-02-16 13:04:41.754079	\N
31	10	ticket_transferido	Ticket transferido de TI	El ticket TKT-202602-0003 ha sido transferido como solicitud SOL-202602-0011	{"ticket_id": 8, "solicitud_id": 11, "ticket_codigo": "TKT-202602-0003", "solicitud_codigo": "SOL-202602-0011"}	f	\N	2026-02-16 13:04:41.754079	\N
33	7	solicitud_aprobada	Solicitud aprobada: SOL-2026-0007	La solicitud "Actualización: djklfjl..." ha sido aprobada por Gerencia	{"codigo": "SOL-2026-0007", "solicitud_id": 7}	f	\N	2026-02-16 13:07:25.660975	\N
11	6	evaluacion_enviada	Nueva evaluación pendiente de aprobación	La solicitud SOL-2026-0001 requiere aprobación de Gerencia	{"solicitud_id": 1, "evaluacion_id": 1, "solicitud_codigo": "SOL-2026-0001"}	t	2026-02-20 02:04:00.43398	2026-02-16 03:40:17.14842	\N
34	10	solicitud_aprobada	Solicitud aprobada: SOL-2026-0007	La solicitud "Actualización: djklfjl..." ha sido aprobada por Gerencia	{"codigo": "SOL-2026-0007", "solicitud_id": 7}	f	\N	2026-02-16 13:07:25.660975	\N
36	7	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0007 ha sido agendado para 1/3/2026	{"codigo": "SOL-2026-0007", "fecha_fin": "2026-04-15T00:00:00.000Z", "fecha_inicio": "2026-03-01T00:00:00.000Z", "solicitud_id": "7"}	f	\N	2026-02-16 13:09:10.310785	\N
37	10	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0007 ha sido agendado para 1/3/2026	{"codigo": "SOL-2026-0007", "fecha_fin": "2026-04-15T00:00:00.000Z", "fecha_inicio": "2026-03-01T00:00:00.000Z", "solicitud_id": "7"}	f	\N	2026-02-16 13:09:10.310785	\N
39	7	reevaluacion_solicitada	Reevaluación solicitada	Gerencia solicita reevaluación de SOL-2026-0007	{"codigo": "SOL-2026-0007", "comentario": "Necesita más detalles en el cronograma", "solicitud_id": "7", "areas_revisar": ["cronograma", "costos"]}	f	\N	2026-02-16 13:10:53.471753	\N
40	10	reevaluacion_solicitada	Reevaluación solicitada	Gerencia solicita reevaluación de SOL-2026-0007	{"codigo": "SOL-2026-0007", "comentario": "Necesita más detalles en el cronograma", "solicitud_id": "7", "areas_revisar": ["cronograma", "costos"]}	f	\N	2026-02-16 13:10:53.471753	\N
41	4	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0006 está lista para su aprobación	{"codigo": "SOL-2026-0006", "solicitud_id": 6, "evaluacion_id": "3"}	f	\N	2026-02-16 13:13:40.732087	\N
43	8	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0006 está lista para su aprobación	{"codigo": "SOL-2026-0006", "solicitud_id": 6, "evaluacion_id": "3"}	f	\N	2026-02-16 13:13:40.732087	\N
45	7	reevaluacion_solicitada	Reevaluación solicitada	Gerencia solicita reevaluación de SOL-2026-0006	{"codigo": "SOL-2026-0006", "comentario": "jj", "solicitud_id": "6", "areas_revisar": ["cronograma"]}	f	\N	2026-02-16 14:01:06.055148	\N
46	10	reevaluacion_solicitada	Reevaluación solicitada	Gerencia solicita reevaluación de SOL-2026-0006	{"codigo": "SOL-2026-0006", "comentario": "jj", "solicitud_id": "6", "areas_revisar": ["cronograma"]}	f	\N	2026-02-16 14:01:06.055148	\N
47	3	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-202602-0004: Soporte: Se me calló el internet\n...	{"codigo": "TKT-202602-0004", "ticket_id": 9}	f	\N	2026-02-16 16:26:27.214954	\N
48	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-202602-0004: Soporte: Se me calló el internet\n...	{"codigo": "TKT-202602-0004", "ticket_id": 9}	f	\N	2026-02-16 16:26:27.214954	\N
49	3	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0015: Soporte: Test completo del formulario con todos los campos	{"codigo": "TKT-2026-0015", "ticket_id": 20}	f	\N	2026-02-16 22:22:45.939125	\N
50	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0015: Soporte: Test completo del formulario con todos los campos	{"codigo": "TKT-2026-0015", "ticket_id": 20}	f	\N	2026-02-16 22:22:45.939125	\N
51	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0012: Proyecto: aa...	{"codigo": "SOL-2026-0012", "solicitud_id": 12}	f	\N	2026-02-17 17:55:07.584554	\N
52	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0012: Proyecto: aa...	{"codigo": "SOL-2026-0012", "solicitud_id": 12}	f	\N	2026-02-17 17:55:07.584554	\N
54	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0013: Proyecto: Para Disciplina Operativa , se necesita realizar e...	{"codigo": "SOL-2026-0013", "solicitud_id": 13}	f	\N	2026-02-17 18:24:30.387784	\N
55	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0013: Proyecto: Para Disciplina Operativa , se necesita realizar e...	{"codigo": "SOL-2026-0013", "solicitud_id": 13}	f	\N	2026-02-17 18:24:30.387784	\N
57	3	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0016: Soporte: dajsfpkfpokpoefjkmfsafmñ...	{"codigo": "TKT-2026-0016", "ticket_id": 21}	f	\N	2026-02-19 20:18:40.820868	\N
58	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0016: Soporte: dajsfpkfpokpoefjkmfsafmñ...	{"codigo": "TKT-2026-0016", "ticket_id": 21}	f	\N	2026-02-19 20:18:40.820868	\N
1	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0001: Proyecto: test desc...	{"codigo": "SOL-2026-0001", "solicitud_id": 1}	t	2026-02-20 01:32:04.859175	2026-02-15 14:53:04.333719	\N
5	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0002: Fallo: fallo fallo fallo fallo...	{"codigo": "SOL-2026-0002", "solicitud_id": 2}	t	2026-02-20 01:32:04.859175	2026-02-15 15:01:15.337984	\N
8	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0003: Cierre: cierre cierre cierre...	{"codigo": "SOL-2026-0003", "solicitud_id": 3}	t	2026-02-20 01:32:04.859175	2026-02-15 15:02:14.716799	\N
14	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0006: Proyecto: problema test NT...	{"codigo": "SOL-2026-0006", "solicitud_id": 6}	t	2026-02-20 01:32:04.859175	2026-02-16 12:35:16.973628	\N
17	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0007: Actualización: djklfjl...	{"codigo": "SOL-2026-0007", "solicitud_id": 7}	t	2026-02-20 01:32:04.859175	2026-02-16 12:40:19.391698	\N
20	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0008: Fallo: jfjoeinamfñmpoeajmfñmañfmeopf...	{"codigo": "SOL-2026-0008", "solicitud_id": 8}	t	2026-02-20 01:32:04.859175	2026-02-16 12:41:59.850533	\N
23	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0009: Cierre: nflejnalfl\nnfleanlfnla...	{"codigo": "SOL-2026-0009", "solicitud_id": 9}	t	2026-02-20 01:32:04.859175	2026-02-16 12:44:31.139948	\N
42	6	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0006 está lista para su aprobación	{"codigo": "SOL-2026-0006", "solicitud_id": 6, "evaluacion_id": "3"}	t	2026-02-20 02:04:03.501709	2026-02-16 13:13:40.732087	\N
26	5	ticket_transferido	Ticket transferido de TI	El ticket TKT-202602-0002 ha sido transferido como solicitud SOL-202602-0010	{"ticket_id": 7, "solicitud_id": 10, "ticket_codigo": "TKT-202602-0002", "solicitud_codigo": "SOL-202602-0010"}	t	2026-02-20 01:32:04.859175	2026-02-16 12:45:30.666322	\N
29	5	ticket_transferido	Ticket transferido de TI	El ticket TKT-202602-0003 ha sido transferido como solicitud SOL-202602-0011	{"ticket_id": 8, "solicitud_id": 11, "ticket_codigo": "TKT-202602-0003", "solicitud_codigo": "SOL-202602-0011"}	t	2026-02-20 01:32:04.859175	2026-02-16 13:04:41.754079	\N
32	5	solicitud_aprobada	Solicitud aprobada: SOL-2026-0007	La solicitud "Actualización: djklfjl..." ha sido aprobada por Gerencia	{"codigo": "SOL-2026-0007", "solicitud_id": 7}	t	2026-02-20 01:32:04.859175	2026-02-16 13:07:25.660975	\N
35	5	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0007 ha sido agendado para 1/3/2026	{"codigo": "SOL-2026-0007", "fecha_fin": "2026-04-15T00:00:00.000Z", "fecha_inicio": "2026-03-01T00:00:00.000Z", "solicitud_id": "7"}	t	2026-02-20 01:32:04.859175	2026-02-16 13:09:10.310785	\N
38	5	reevaluacion_solicitada	Reevaluación solicitada	Gerencia solicita reevaluación de SOL-2026-0007	{"codigo": "SOL-2026-0007", "comentario": "Necesita más detalles en el cronograma", "solicitud_id": "7", "areas_revisar": ["cronograma", "costos"]}	t	2026-02-20 01:32:04.859175	2026-02-16 13:10:53.471753	\N
44	5	reevaluacion_solicitada	Reevaluación solicitada	Gerencia solicita reevaluación de SOL-2026-0006	{"codigo": "SOL-2026-0006", "comentario": "jj", "solicitud_id": "6", "areas_revisar": ["cronograma"]}	t	2026-02-20 01:32:04.859175	2026-02-16 14:01:06.055148	\N
53	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0012: Proyecto: aa...	{"codigo": "SOL-2026-0012", "solicitud_id": 12}	t	2026-02-20 01:32:04.859175	2026-02-17 17:55:07.584554	\N
56	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0013: Proyecto: Para Disciplina Operativa , se necesita realizar e...	{"codigo": "SOL-2026-0013", "solicitud_id": 13}	t	2026-02-20 01:32:04.859175	2026-02-17 18:24:30.387784	\N
60	8	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0006 está lista para su aprobación	{"codigo": "SOL-2026-0006", "solicitud_id": 6, "evaluacion_id": "3"}	f	\N	2026-02-20 02:00:18.530993	\N
59	6	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0006 está lista para su aprobación	{"codigo": "SOL-2026-0006", "solicitud_id": 6, "evaluacion_id": "3"}	t	2026-02-20 02:04:08.572196	2026-02-20 02:00:18.530993	\N
61	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0017: jñfñsakñkñ	{"codigo": "TKT-2026-0017", "ticket_id": 22}	f	\N	2026-02-20 02:18:17.882073	\N
62	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0018: jpoñkpokpk	{"codigo": "TKT-2026-0018", "ticket_id": 23}	f	\N	2026-02-20 03:22:15.496808	\N
63	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0019: Test IT Ticket - Impresora no funciona	{"codigo": "TKT-2026-0019", "ticket_id": 24}	f	\N	2026-02-20 03:24:51.299871	\N
64	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0014: Error en sistema de facturacion	{"codigo": "SOL-2026-0014", "solicitud_id": 14}	f	\N	2026-02-20 03:25:47.088908	\N
65	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0014: Error en sistema de facturacion	{"codigo": "SOL-2026-0014", "solicitud_id": 14}	f	\N	2026-02-20 03:25:47.088908	\N
66	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0014: Error en sistema de facturacion	{"codigo": "SOL-2026-0014", "solicitud_id": 14}	f	\N	2026-02-20 03:25:47.088908	\N
67	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0015: Cierre del sistema legacy de inventarios	{"codigo": "SOL-2026-0015", "solicitud_id": 15}	f	\N	2026-02-20 03:26:18.548198	\N
68	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0015: Cierre del sistema legacy de inventarios	{"codigo": "SOL-2026-0015", "solicitud_id": 15}	f	\N	2026-02-20 03:26:18.548198	\N
69	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0015: Cierre del sistema legacy de inventarios	{"codigo": "SOL-2026-0015", "solicitud_id": 15}	f	\N	2026-02-20 03:26:18.548198	\N
70	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0016: Cierre de portal de reportes antiguo	{"codigo": "SOL-2026-0016", "solicitud_id": 16}	f	\N	2026-02-20 03:26:34.980249	\N
71	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0016: Cierre de portal de reportes antiguo	{"codigo": "SOL-2026-0016", "solicitud_id": 16}	f	\N	2026-02-20 03:26:34.980249	\N
72	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0016: Cierre de portal de reportes antiguo	{"codigo": "SOL-2026-0016", "solicitud_id": 16}	f	\N	2026-02-20 03:26:34.980249	\N
73	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0017: Sistema de gestion de contratos	{"codigo": "SOL-2026-0017", "solicitud_id": 17}	f	\N	2026-02-20 03:28:10.642679	\N
74	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0017: Sistema de gestion de contratos	{"codigo": "SOL-2026-0017", "solicitud_id": 17}	f	\N	2026-02-20 03:28:10.642679	\N
75	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0017: Sistema de gestion de contratos	{"codigo": "SOL-2026-0017", "solicitud_id": 17}	f	\N	2026-02-20 03:28:10.642679	\N
76	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0018: App movil para reportes de campo	{"codigo": "SOL-2026-0018", "solicitud_id": 18}	f	\N	2026-02-20 03:28:32.663412	\N
77	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0018: App movil para reportes de campo	{"codigo": "SOL-2026-0018", "solicitud_id": 18}	f	\N	2026-02-20 03:28:32.663412	\N
78	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0018: App movil para reportes de campo	{"codigo": "SOL-2026-0018", "solicitud_id": 18}	f	\N	2026-02-20 03:28:32.663412	\N
79	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0019: Mejoras al sistema de facturacion	{"codigo": "SOL-2026-0019", "solicitud_id": 19}	f	\N	2026-02-20 03:28:56.50957	\N
80	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0019: Mejoras al sistema de facturacion	{"codigo": "SOL-2026-0019", "solicitud_id": 19}	f	\N	2026-02-20 03:28:56.50957	\N
81	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0019: Mejoras al sistema de facturacion	{"codigo": "SOL-2026-0019", "solicitud_id": 19}	f	\N	2026-02-20 03:28:56.50957	\N
82	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0020: Nuevos reportes para sistema de inventarios	{"codigo": "SOL-2026-0020", "solicitud_id": 20}	f	\N	2026-02-20 03:29:59.128378	\N
83	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0020: Nuevos reportes para sistema de inventarios	{"codigo": "SOL-2026-0020", "solicitud_id": 20}	f	\N	2026-02-20 03:29:59.128378	\N
84	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0020: Nuevos reportes para sistema de inventarios	{"codigo": "SOL-2026-0020", "solicitud_id": 20}	f	\N	2026-02-20 03:29:59.128378	\N
85	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0020: URGENTE: Servidor de produccion caido	{"codigo": "TKT-2026-0020", "ticket_id": 25}	f	\N	2026-02-20 03:30:24.76234	\N
86	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0021: Falla de conectividad en sede norte	{"codigo": "SOL-2026-0021", "solicitud_id": 21}	f	\N	2026-02-20 03:30:24.829581	\N
87	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0021: Falla de conectividad en sede norte	{"codigo": "SOL-2026-0021", "solicitud_id": 21}	f	\N	2026-02-20 03:30:24.829581	\N
88	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0021: Falla de conectividad en sede norte	{"codigo": "SOL-2026-0021", "solicitud_id": 21}	f	\N	2026-02-20 03:30:24.829581	\N
89	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0021: PRUEBA COMPLETA: Falla critica en sistema ERP	{"codigo": "TKT-2026-0021", "ticket_id": 26}	f	\N	2026-02-20 03:36:03.24366	\N
90	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0022: VERIFY: Error de impresora en recepcion	{"codigo": "TKT-2026-0022", "ticket_id": 27}	f	\N	2026-02-20 03:43:45.49025	\N
91	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0022: VERIFY: Error de nomina	{"codigo": "SOL-2026-0022", "solicitud_id": 22}	f	\N	2026-02-20 03:45:25.609592	\N
92	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0022: VERIFY: Error de nomina	{"codigo": "SOL-2026-0022", "solicitud_id": 22}	f	\N	2026-02-20 03:45:25.609592	\N
93	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0022: VERIFY: Error de nomina	{"codigo": "SOL-2026-0022", "solicitud_id": 22}	f	\N	2026-02-20 03:45:25.609592	\N
94	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0023: VERIFY: Cierre de servidor FILESRV01	{"codigo": "SOL-2026-0023", "solicitud_id": 23}	f	\N	2026-02-20 03:45:56.90035	\N
95	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0023: VERIFY: Cierre de servidor FILESRV01	{"codigo": "SOL-2026-0023", "solicitud_id": 23}	f	\N	2026-02-20 03:45:56.90035	\N
96	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0023: VERIFY: Cierre de servidor FILESRV01	{"codigo": "SOL-2026-0023", "solicitud_id": 23}	f	\N	2026-02-20 03:45:56.90035	\N
97	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0024: VERIFY: Portal de autoservicio empleados	{"codigo": "SOL-2026-0024", "solicitud_id": 24}	f	\N	2026-02-20 03:45:56.941746	\N
98	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0024: VERIFY: Portal de autoservicio empleados	{"codigo": "SOL-2026-0024", "solicitud_id": 24}	f	\N	2026-02-20 03:45:56.941746	\N
99	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0024: VERIFY: Portal de autoservicio empleados	{"codigo": "SOL-2026-0024", "solicitud_id": 24}	f	\N	2026-02-20 03:45:56.941746	\N
100	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0025: VERIFY: Modulo trazabilidad ERP	{"codigo": "SOL-2026-0025", "solicitud_id": 25}	f	\N	2026-02-20 03:46:32.51803	\N
101	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0025: VERIFY: Modulo trazabilidad ERP	{"codigo": "SOL-2026-0025", "solicitud_id": 25}	f	\N	2026-02-20 03:46:32.51803	\N
102	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0025: VERIFY: Modulo trazabilidad ERP	{"codigo": "SOL-2026-0025", "solicitud_id": 25}	f	\N	2026-02-20 03:46:32.51803	\N
103	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0026: FILETEST: Error con archivos adjuntos	{"codigo": "SOL-2026-0026", "solicitud_id": 26}	f	\N	2026-02-20 04:10:03.020765	\N
104	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0026: FILETEST: Error con archivos adjuntos	{"codigo": "SOL-2026-0026", "solicitud_id": 26}	f	\N	2026-02-20 04:10:03.020765	\N
105	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0026: FILETEST: Error con archivos adjuntos	{"codigo": "SOL-2026-0026", "solicitud_id": 26}	f	\N	2026-02-20 04:10:03.020765	\N
106	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0027: giuhonlm	{"codigo": "SOL-2026-0027", "solicitud_id": 27}	f	\N	2026-02-20 04:34:27.088296	\N
107	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0027: giuhonlm	{"codigo": "SOL-2026-0027", "solicitud_id": 27}	f	\N	2026-02-20 04:34:27.088296	\N
108	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0027: giuhonlm	{"codigo": "SOL-2026-0027", "solicitud_id": 27}	f	\N	2026-02-20 04:34:27.088296	\N
109	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0028: uhinl	{"codigo": "SOL-2026-0028", "solicitud_id": 28}	f	\N	2026-02-20 04:45:04.795662	\N
110	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0028: uhinl	{"codigo": "SOL-2026-0028", "solicitud_id": 28}	f	\N	2026-02-20 04:45:04.795662	\N
111	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0028: uhinl	{"codigo": "SOL-2026-0028", "solicitud_id": 28}	f	\N	2026-02-20 04:45:04.795662	\N
112	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0023: tfyguhinomp	{"codigo": "TKT-2026-0023", "ticket_id": 28}	f	\N	2026-02-20 04:45:58.754208	\N
113	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0029: uyhio	{"codigo": "SOL-2026-0029", "solicitud_id": 29}	f	\N	2026-02-20 04:48:06.004496	\N
114	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0029: uyhio	{"codigo": "SOL-2026-0029", "solicitud_id": 29}	f	\N	2026-02-20 04:48:06.004496	\N
115	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0029: uyhio	{"codigo": "SOL-2026-0029", "solicitud_id": 29}	f	\N	2026-02-20 04:48:06.004496	\N
116	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0030: yughinom	{"codigo": "SOL-2026-0030", "solicitud_id": 30}	f	\N	2026-02-20 04:49:55.589219	\N
117	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0030: yughinom	{"codigo": "SOL-2026-0030", "solicitud_id": 30}	f	\N	2026-02-20 04:49:55.589219	\N
118	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0030: yughinom	{"codigo": "SOL-2026-0030", "solicitud_id": 30}	f	\N	2026-02-20 04:49:55.589219	\N
119	9	nuevo_ticket	Nuevo ticket de soporte	Nuevo ticket TKT-2026-0024: guyiuhonpm	{"codigo": "TKT-2026-0024", "ticket_id": 29}	f	\N	2026-02-20 04:50:45.960646	\N
120	5	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0023 ha sido transferido como solicitud SOL-202602-0031	{"ticket_id": 28, "solicitud_id": 31, "ticket_codigo": "TKT-2026-0023", "solicitud_codigo": "SOL-202602-0031"}	f	\N	2026-02-20 04:53:25.251267	\N
121	7	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0023 ha sido transferido como solicitud SOL-202602-0031	{"ticket_id": 28, "solicitud_id": 31, "ticket_codigo": "TKT-2026-0023", "solicitud_codigo": "SOL-202602-0031"}	f	\N	2026-02-20 04:53:25.251267	\N
122	10	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0023 ha sido transferido como solicitud SOL-202602-0031	{"ticket_id": 28, "solicitud_id": 31, "ticket_codigo": "TKT-2026-0023", "solicitud_codigo": "SOL-202602-0031"}	f	\N	2026-02-20 04:53:25.251267	\N
123	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0032: jkñ,iojpko	{"codigo": "SOL-2026-0032", "solicitud_id": 32}	f	\N	2026-02-20 05:08:37.972083	\N
124	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0032: jkñ,iojpko	{"codigo": "SOL-2026-0032", "solicitud_id": 32}	f	\N	2026-02-20 05:08:37.972083	\N
125	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0032: jkñ,iojpko	{"codigo": "SOL-2026-0032", "solicitud_id": 32}	f	\N	2026-02-20 05:08:37.972083	\N
126	5	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0033: jfpokeajf	{"codigo": "SOL-2026-0033", "solicitud_id": 33}	f	\N	2026-02-20 05:13:42.406301	\N
127	7	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0033: jfpokeajf	{"codigo": "SOL-2026-0033", "solicitud_id": 33}	f	\N	2026-02-20 05:13:42.406301	\N
128	10	nueva_solicitud	Nueva solicitud recibida	Nueva solicitud SOL-2026-0033: jfpokeajf	{"codigo": "SOL-2026-0033", "solicitud_id": 33}	f	\N	2026-02-20 05:13:42.406301	\N
129	5	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0021 ha sido transferido como solicitud SOL-202602-0034	{"ticket_id": 26, "solicitud_id": 34, "ticket_codigo": "TKT-2026-0021", "solicitud_codigo": "SOL-202602-0034"}	f	\N	2026-02-20 06:28:28.380805	\N
130	7	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0021 ha sido transferido como solicitud SOL-202602-0034	{"ticket_id": 26, "solicitud_id": 34, "ticket_codigo": "TKT-2026-0021", "solicitud_codigo": "SOL-202602-0034"}	f	\N	2026-02-20 06:28:28.380805	\N
131	10	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0021 ha sido transferido como solicitud SOL-202602-0034	{"ticket_id": 26, "solicitud_id": 34, "ticket_codigo": "TKT-2026-0021", "solicitud_codigo": "SOL-202602-0034"}	f	\N	2026-02-20 06:28:28.380805	\N
132	5	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0020 ha sido transferido como solicitud SOL-202602-0035	{"ticket_id": 25, "solicitud_id": 35, "ticket_codigo": "TKT-2026-0020", "solicitud_codigo": "SOL-202602-0035"}	f	\N	2026-02-20 06:28:51.910733	\N
133	7	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0020 ha sido transferido como solicitud SOL-202602-0035	{"ticket_id": 25, "solicitud_id": 35, "ticket_codigo": "TKT-2026-0020", "solicitud_codigo": "SOL-202602-0035"}	f	\N	2026-02-20 06:28:51.910733	\N
134	10	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0020 ha sido transferido como solicitud SOL-202602-0035	{"ticket_id": 25, "solicitud_id": 35, "ticket_codigo": "TKT-2026-0020", "solicitud_codigo": "SOL-202602-0035"}	f	\N	2026-02-20 06:28:51.910733	\N
135	5	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0022 ha sido transferido como solicitud SOL-202602-0036	{"ticket_id": 27, "solicitud_id": 36, "ticket_codigo": "TKT-2026-0022", "solicitud_codigo": "SOL-202602-0036"}	f	\N	2026-02-20 06:53:26.769669	\N
136	7	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0022 ha sido transferido como solicitud SOL-202602-0036	{"ticket_id": 27, "solicitud_id": 36, "ticket_codigo": "TKT-2026-0022", "solicitud_codigo": "SOL-202602-0036"}	f	\N	2026-02-20 06:53:26.769669	\N
137	10	ticket_transferido	Ticket transferido de TI	El ticket TKT-2026-0022 ha sido transferido como solicitud SOL-202602-0036	{"ticket_id": 27, "solicitud_id": 36, "ticket_codigo": "TKT-2026-0022", "solicitud_codigo": "SOL-202602-0036"}	f	\N	2026-02-20 06:53:26.769669	\N
138	9	solicitud_transferida	Solicitud transferida de NT	La solicitud SOL-2026-0029 ha sido transferida como ticket TKT-202602-0025	{"ticket_id": 30, "solicitud_id": 29, "ticket_codigo": "TKT-202602-0025", "solicitud_codigo": "SOL-2026-0029"}	f	\N	2026-02-20 07:24:08.97713	\N
139	6	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0033 está lista para su aprobación	{"codigo": "SOL-2026-0033", "solicitud_id": 33, "evaluacion_id": "6"}	f	\N	2026-02-20 09:00:42.036235	\N
140	8	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0033 está lista para su aprobación	{"codigo": "SOL-2026-0033", "solicitud_id": 33, "evaluacion_id": "6"}	f	\N	2026-02-20 09:00:42.036235	\N
141	10	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0033 ha sido agendado para 20/2/2026	{"codigo": "SOL-2026-0033", "fecha_fin": "2026-03-30T00:00:00.000Z", "fecha_inicio": "2026-02-20T00:00:00.000Z", "solicitud_id": 33}	f	\N	2026-02-20 11:44:36.385487	\N
142	7	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0033 ha sido agendado para 20/2/2026	{"codigo": "SOL-2026-0033", "fecha_fin": "2026-03-30T00:00:00.000Z", "fecha_inicio": "2026-02-20T00:00:00.000Z", "solicitud_id": 33}	f	\N	2026-02-20 11:44:36.385487	\N
143	5	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0033 ha sido agendado para 20/2/2026	{"codigo": "SOL-2026-0033", "fecha_fin": "2026-03-30T00:00:00.000Z", "fecha_inicio": "2026-02-20T00:00:00.000Z", "solicitud_id": 33}	f	\N	2026-02-20 11:44:36.385487	\N
144	10	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0006 ha sido agendado para 23/2/2026	{"codigo": "SOL-2026-0006", "fecha_fin": "2026-04-29T00:00:00.000Z", "fecha_inicio": "2026-02-23T00:00:00.000Z", "solicitud_id": 6}	f	\N	2026-02-20 11:45:32.067664	\N
145	7	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0006 ha sido agendado para 23/2/2026	{"codigo": "SOL-2026-0006", "fecha_fin": "2026-04-29T00:00:00.000Z", "fecha_inicio": "2026-02-23T00:00:00.000Z", "solicitud_id": 6}	f	\N	2026-02-20 11:45:32.067664	\N
146	5	proyecto_agendado	Proyecto agendado	El proyecto SOL-2026-0006 ha sido agendado para 23/2/2026	{"codigo": "SOL-2026-0006", "fecha_fin": "2026-04-29T00:00:00.000Z", "fecha_inicio": "2026-02-23T00:00:00.000Z", "solicitud_id": 6}	f	\N	2026-02-20 11:45:32.067664	\N
147	8	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0032 está lista para su aprobación	{"codigo": "SOL-2026-0032", "solicitud_id": 32, "evaluacion_id": "7"}	f	\N	2026-02-20 11:47:06.997396	\N
148	6	aprobacion_pendiente	Solicitud pendiente de aprobación	La solicitud SOL-2026-0032 está lista para su aprobación	{"codigo": "SOL-2026-0032", "solicitud_id": 32, "evaluacion_id": "7"}	f	\N	2026-02-20 11:47:06.997396	\N
\.


--
-- Data for Name: opciones_formulario; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.opciones_formulario (id, categoria, valor, etiqueta, padre_id, orden, activo, creado_en, actualizado_en) FROM stdin;
1	area	gerencia_general	Gerencia General	\N	1	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
2	area	operaciones	Operaciones	\N	2	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
3	area	administracion	Administración	\N	3	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
4	area	nuevas_tecnologias	Nuevas Tecnologías	\N	4	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
5	area	ti	Tecnología de la Información	\N	5	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
6	area	rrhh	Recursos Humanos	\N	6	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
7	area	hse	HSE	\N	7	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
8	area	calidad	Calidad	\N	8	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
9	area	compras	Compras	\N	9	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
10	area	contabilidad	Contabilidad	\N	10	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
11	area	mantenimiento	Mantenimiento	\N	11	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
12	area	logistica	Logística	\N	12	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
13	area	comercial	Comercial	\N	13	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
14	area	juridico	Jurídico	\N	14	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
15	area	proyectos	Proyectos	\N	15	t	2026-02-15 14:47:49.2262	2026-02-15 14:47:49.2262
16	area	operaciones_planta	Planta	2	1	t	2026-02-15 14:47:49.239125	2026-02-15 14:47:49.239125
17	area	operaciones_campo	Campo	2	2	t	2026-02-15 14:47:49.250521	2026-02-15 14:47:49.250521
18	area	operaciones_taller	Taller	2	3	t	2026-02-15 14:47:49.255492	2026-02-15 14:47:49.255492
19	operacion_contrato	oficina_principal	Oficina Principal	\N	1	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
20	operacion_contrato	planta_barranca	Planta Barrancabermeja	\N	2	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
21	operacion_contrato	planta_cartagena	Planta Cartagena	\N	3	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
22	operacion_contrato	contrato_ecopetrol	Contrato Ecopetrol	\N	4	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
23	operacion_contrato	contrato_oxy	Contrato OXY	\N	5	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
24	operacion_contrato	contrato_gran_tierra	Contrato Gran Tierra	\N	6	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
25	operacion_contrato	contrato_parex	Contrato Parex	\N	7	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
26	operacion_contrato	contrato_frontera	Contrato Frontera Energy	\N	8	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
27	operacion_contrato	otro	Otro	\N	99	t	2026-02-15 14:47:49.260564	2026-02-15 14:47:49.260564
28	urgencia	inmediata	Inmediata (< 1 semana)	\N	1	t	2026-02-15 14:47:49.269133	2026-02-15 14:47:49.269133
29	urgencia	corto_plazo	Corto Plazo (1-4 semanas)	\N	2	t	2026-02-15 14:47:49.269133	2026-02-15 14:47:49.269133
30	urgencia	mediano_plazo	Mediano Plazo (1-3 meses)	\N	3	t	2026-02-15 14:47:49.269133	2026-02-15 14:47:49.269133
31	urgencia	largo_plazo	Largo Plazo (> 3 meses)	\N	4	t	2026-02-15 14:47:49.269133	2026-02-15 14:47:49.269133
32	tipo_solucion	aplicacion_web	Aplicación Web	\N	1	t	2026-02-15 14:47:49.273936	2026-02-15 14:47:49.273936
33	tipo_solucion	aplicacion_movil	Aplicación Móvil	\N	2	t	2026-02-15 14:47:49.273936	2026-02-15 14:47:49.273936
34	tipo_solucion	automatizacion	Automatización de Proceso	\N	3	t	2026-02-15 14:47:49.273936	2026-02-15 14:47:49.273936
35	tipo_solucion	integracion	Integración de Sistemas	\N	4	t	2026-02-15 14:47:49.273936	2026-02-15 14:47:49.273936
36	tipo_solucion	reporte_dashboard	Reporte/Dashboard	\N	5	t	2026-02-15 14:47:49.273936	2026-02-15 14:47:49.273936
37	tipo_solucion	otro	Otro (especificar)	\N	99	t	2026-02-15 14:47:49.273936	2026-02-15 14:47:49.273936
38	forma_entrega	web	Aplicación Web	\N	1	t	2026-02-15 14:47:49.278964	2026-02-15 14:47:49.278964
39	forma_entrega	movil	Aplicación Móvil	\N	2	t	2026-02-15 14:47:49.278964	2026-02-15 14:47:49.278964
40	forma_entrega	escritorio	Aplicación de Escritorio	\N	3	t	2026-02-15 14:47:49.278964	2026-02-15 14:47:49.278964
41	forma_entrega	reporte	Reporte Periódico	\N	4	t	2026-02-15 14:47:49.278964	2026-02-15 14:47:49.278964
42	forma_entrega	dashboard	Dashboard en Tiempo Real	\N	5	t	2026-02-15 14:47:49.278964	2026-02-15 14:47:49.278964
43	forma_entrega	api	API/Servicio	\N	6	t	2026-02-15 14:47:49.278964	2026-02-15 14:47:49.278964
44	criticidad	baja	Baja - Impacto mínimo	\N	1	t	2026-02-15 14:47:49.284093	2026-02-15 14:47:49.284093
45	criticidad	media	Media - Afecta productividad	\N	2	t	2026-02-15 14:47:49.284093	2026-02-15 14:47:49.284093
46	criticidad	alta	Alta - Detiene procesos críticos	\N	3	t	2026-02-15 14:47:49.284093	2026-02-15 14:47:49.284093
47	criticidad	critica	Crítica - Impacto en seguridad/negocio	\N	4	t	2026-02-15 14:47:49.284093	2026-02-15 14:47:49.284093
\.


--
-- Data for Name: proyecto_miembros; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.proyecto_miembros (id, proyecto_id, usuario_id, rol_proyecto, asignado_en) FROM stdin;
\.


--
-- Data for Name: proyecto_pausas; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.proyecto_pausas (id, solicitud_id, fecha_inicio, fecha_fin, motivo, dias_pausados, creado_por, creado_en) FROM stdin;
\.


--
-- Data for Name: proyecto_tareas; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.proyecto_tareas (id, proyecto_id, titulo, descripcion, fecha_inicio, fecha_fin, progreso, completada, asignado_id, color, orden, creado_en, actualizado_en) FROM stdin;
\.


--
-- Data for Name: proyectos; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.proyectos (id, codigo, solicitud_id, titulo, descripcion, estado, fecha_inicio_estimada, fecha_fin_estimada, fecha_inicio_real, fecha_fin_real, presupuesto_estimado, presupuesto_real, responsable_id, datos_proyecto, creado_en, actualizado_en) FROM stdin;
1	PRY-2026-0001	7	Actualización: djklfjl...		pausado	2026-03-01	2026-04-15	\N	\N	\N	\N	4	{"kpis": [{"nombre": "jfpoeajpñf", "unidad": "m", "valor_actual": "2", "valor_objetivo": "30"}, {"nombre": "jfoeia", "unidad": "h", "valor_actual": "0", "valor_objetivo": "30"}], "beneficios": {"descripcion": "jfejapñef", "mejora_concreta": "jefñajñfe", "reduccion_costos": true, "costos_descripcion": "oejakfpojpfjae", "procesos_optimizados": ["jefijlaef"]}, "solicitante": {"area": "gerencia_general", "cargo": "nt", "cedula": "1005257395", "correo": "Andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andrés Pérez", "operacion_contrato": "oficina_principal"}, "stakeholders": {"externas": {"empresas": ["sjdkla"], "personas": ["jdklasd"], "sectores": ["djklfk"], "proveedores": ["sdjdl"]}, "internas": {"areas": ["ajdk"], "personas": ["adjk"]}, "aplica_externas": true}}	2026-02-16 13:07:25.636339	2026-02-20 10:41:58.6321
2	PRY-2026-0002	33	jfpokeajf	jfaepkof	planificacion	2026-02-20	2026-03-30	\N	\N	\N	\N	6	{"kpis": [], "beneficios": {"descripcion": "uybinomiuhojp", "mejora_concreta": "hiuojp", "beneficio_monetario": {}}, "solicitante": {"area": "gerencia_general", "cargo": "efmlf", "cedula": "380", "correo": "fmepfk@i.co", "es_doliente": true, "nombre_completo": "fjpkeof", "operacion_contrato": "oficina_principal"}, "stakeholders": {"internas": {}}}	2026-02-20 11:44:36.385487	2026-02-20 11:44:36.385487
3	PRY-2026-0003	6	Mejora del portal de clientes	problema test NT	planificacion	2026-02-23	2026-04-29	\N	\N	\N	\N	6	{"kpis": [{"nombre": "kpi", "unidad": "20", "valor_actual": "0", "valor_objetivo": "30"}], "beneficios": {"descripcion": "hfiosajd", "mejora_concreta": "knsflkad", "reduccion_costos": false, "procesos_optimizados": ["proceso"]}, "solicitante": {"area": "gerencia_general", "cargo": "NT", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andrés Pérez", "operacion_contrato": "oficina_principal"}, "stakeholders": {"internas": {"areas": ["it"], "personas": ["jesus cotes"]}, "aplica_externas": false}}	2026-02-20 11:45:32.067664	2026-02-20 11:45:32.067664
\.


--
-- Data for Name: reportes_semanales; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.reportes_semanales (id, fecha_inicio, fecha_fin, datos, creado_en) FROM stdin;
\.


--
-- Data for Name: respuestas_pendientes; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.respuestas_pendientes (id, token, comentario_id, entidad_tipo, entidad_id, email_destino, usuario_pregunta_id, creado_en, expira_en, usado) FROM stdin;
1	ca9e9a6ee66122caa6ac8c8778c61ecf369a73aee69094f16be549e8bba84c98	32	solicitud	33	fmepfk@i.co	5	2026-02-20 05:45:29.061054	2026-02-27 05:45:29.06	t
\.


--
-- Data for Name: sesiones; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.sesiones (id, usuario_id, token, expira_en, activa, ip_address, user_agent, creado_en) FROM stdin;
11	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA4OTgyMzcsImV4cCI6MTc3MDk4NDYzN30.ipJOkhzF77aGJnPnpBeI4VdQFIP4bvY83FxhwLNMJZ0	2026-02-13 12:10:37.17	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:10:37.170393
1	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDg0MTA2OCwiZXhwIjoxNzcwOTI3NDY4fQ._F-Wkb5-aAkmE7JzhG_RoGyCskHW59emTHQvZeYg6ks	2026-02-12 20:17:48.368	f	::ffff:172.26.0.1	curl/8.5.0	2026-02-11 20:17:48.369033
2	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDg3NjQ0OCwiZXhwIjoxNzcwOTYyODQ4fQ.sBdFFPwqmZikiGyOjOppPDJDU-vhxFdS91yJU3Ci9CI	2026-02-13 06:07:28.381	f	::ffff:192.168.0.200	curl/8.5.0	2026-02-12 06:07:28.381734
3	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDg3NjQ4NSwiZXhwIjoxNzcwOTYyODg1fQ.tkVAaH0IldRlW1EDIdYEuOBPOterpJhTJZtzGco0m_g	2026-02-13 06:08:05.147	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 06:08:05.148132
6	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcwODc2NjUwLCJleHAiOjE3NzA5NjMwNTB9.0rLLwjy4yZCtNvwEMpygD55RisRACKAAGr2RZdTZI1k	2026-02-13 06:10:50.772	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 06:10:50.772711
9	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcwODk4MDU2LCJleHAiOjE3NzA5ODQ0NTZ9.lRWqmwAZ8OiQwiUl_TIwpimLXIMQYLlos0ypjng2auw	2026-02-13 12:07:36.167	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:07:36.167462
5	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcwODc2NjA4LCJleHAiOjE3NzA5NjMwMDh9.gu3d-1VeYXgSLZEclHrRH4WfcFBkjffh3v-PjSGHpR4	2026-02-13 06:10:08.391	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 06:10:08.392029
8	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcwODk4MDMzLCJleHAiOjE3NzA5ODQ0MzN9.EGpjnj9aHv_USWby__CXbHrgdJFZHXpHvEO46H309xU	2026-02-13 12:07:13.826	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:07:13.826605
4	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoibnRAaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDg3NjU3NSwiZXhwIjoxNzcwOTYyOTc1fQ.Ia1Ej54xYWBHKf4_fXyvQFyrTmc5s2YW8V6bKZzGBcA	2026-02-13 06:09:35.934	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 06:09:35.93544
7	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoibnRAaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDg5Nzg1MCwiZXhwIjoxNzcwOTg0MjUwfQ.6DGuWTxefiMfFVl6OhbJE3_gIav67QrzZrnWK_rZDnw	2026-02-13 12:04:10.69	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:04:10.690771
13	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MDEwMzEsImV4cCI6MTc3MDk4NzQzMX0.XK3SAC4QRfxxeF_9_HQas0pGJZpzcx4E053ogY35OWA	2026-02-13 12:57:11.076	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:57:11.077117
10	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoibnRAaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDg5ODEzOSwiZXhwIjoxNzcwOTg0NTM5fQ.yBaiCLKHX4eohO-oJXBZGZZRxcccluHTcwUmC794af8	2026-02-13 12:08:59.192	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:08:59.193151
12	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoibnRAaW5lbWVjLmNvbSIsInJvbCI6Im51ZXZhc190ZWNub2xvZ2lhcyIsImlhdCI6MTc3MDkwMDYzMiwiZXhwIjoxNzcwOTg3MDMyfQ.s60BhxMLYdbeS_A95FMtp8XQjxBpdprt7lzjNjnNPpg	2026-02-13 12:50:32.757	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:50:32.758035
14	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MDExNTYsImV4cCI6MTc3MDk4NzU1Nn0.f821sqQdIHJhxYZw-9gklHqDaH2pSWduiLnGNPB0gEU	2026-02-13 12:59:16.286	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 12:59:16.286644
15	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MDkwMTIzNiwiZXhwIjoxNzcwOTg3NjM2fQ.j9s1RRJMcA8iPPC4ZfYfJ8Z-p7-Y9tCmVtInGpjghxc	2026-02-13 13:00:36.007	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 13:00:36.007276
16	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MDkwMTI1MywiZXhwIjoxNzcwOTg3NjUzfQ.7ECP2xRrSnQKug2BikUEkLz3MntMUCS-310OcyRMv4w	2026-02-13 13:00:53.308	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 13:00:53.309039
17	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MDU3NDEsImV4cCI6MTc3MDk5MjE0MX0.VBrIqvxwzmkByrmy4cD9PQIPO0BCVelEIexP8_V7ix0	2026-02-13 14:15:41.979	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 14:15:41.980378
18	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MTQzNTYsImV4cCI6MTc3MTAwMDc1Nn0.3EIOEl0OX1UQZmCpsNf9h46VwwSOUAUyu7IRWsJntZs	2026-02-13 16:39:16.573	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 16:39:16.573365
19	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MTQ1MDksImV4cCI6MTc3MTAwMDkwOX0.f085xOuwSIT6FH6dYxi9gMJAsweg0aUcex66dakx4FE	2026-02-13 16:41:49.442	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 16:41:49.442345
20	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MTg5NzUsImV4cCI6MTc3MTAwNTM3NX0.wBuO61_grrSqTJCVoEEyhzBUJHVOzl-ovkiz54h_PNM	2026-02-13 17:56:15.386	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 17:56:15.386308
21	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MTkyNjQsImV4cCI6MTc3MTAwNTY2NH0.EIcFvakoothB6D5jIThM2Sv6h5T_UZqqWPwMfN-MWK0	2026-02-13 18:01:04.948	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 18:01:04.948802
22	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MTk0NDgsImV4cCI6MTc3MTAwNTg0OH0.PuqKwWpSQgqElJxK2GGjbqyiuyf6kanfBV_2k4k6uRY	2026-02-13 18:04:08.334	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 18:04:08.334566
23	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MDkxOTQ5MCwiZXhwIjoxNzcxMDA1ODkwfQ.-DALUpD9oEv_svOemJ14FX0aM4_rbMvQuK4OPhqPCew	2026-02-13 18:04:50.45	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 18:04:50.450681
24	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MjMwNTAsImV4cCI6MTc3MTAwOTQ1MH0.9_H5XmZeH72GSOT3qubV0u6L8xiU3By2x6GW1NoHgJM	2026-02-13 19:04:10.33	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 19:04:10.330905
25	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MDkyMzE2OSwiZXhwIjoxNzcxMDA5NTY5fQ.4yWyQyYhWwVXoXfioQQxZHE-hcBpge3nrnILIuV-YNU	2026-02-13 19:06:09.811	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 19:06:09.812425
26	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzA5MjM0OTcsImV4cCI6MTc3MTAwOTg5N30.QQ8T0lQS5p6fF4SYC1lcWEIvA5gdXFhEVnkaRteCxe0	2026-02-13 19:11:37.323	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 19:11:37.323578
27	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MDkyMzU0MCwiZXhwIjoxNzcxMDA5OTQwfQ.iC_-7Ov0_FR8Y228ZGiafl013t_piNns1tkc6rm1hbA	2026-02-13 19:12:20.128	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-12 19:12:20.128898
28	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzExNjcyMDcsImV4cCI6MTc3MTI1MzYwN30.UADPKux5F7WUMjEsZgJVVV1dmzQRnORVYFSWgv2i8XI	2026-02-16 14:53:27.648	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-15 14:53:27.648675
29	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTE2NzQ3MywiZXhwIjoxNzcxMjUzODczfQ.ta91sSnDA0eEvSPVT6AszRivQN5KXvFkyidxDEBcUck	2026-02-16 14:57:53.816	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-15 14:57:53.816587
30	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzExNjc3NTgsImV4cCI6MTc3MTI1NDE1OH0.-rVZEv7nEbj4eXImCW-DvaZ4lYZbYD4FyDZjEa-3kAE	2026-02-16 15:02:38.423	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-15 15:02:38.423554
31	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzExOTgzMzUsImV4cCI6MTc3MTI4NDczNX0.KtLiDzGjCq3UdOE-0beGoBOrlEl_jMGvD1y4gvc4F2U	2026-02-16 23:32:15.028	t	::ffff:192.168.0.202	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-15 23:32:15.028666
32	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzExOTg3NjQsImV4cCI6MTc3MTI4NTE2NH0.fJkmQ0-sZ6zChigEEjrAukJF_dgCdZmjOGy1hCovm00	2026-02-16 23:39:24.886	t	::ffff:192.168.0.202	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-15 23:39:24.886536
33	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyMDM5ODcsImV4cCI6MTc3MTI5MDM4N30.2VBt3r4iuEsEweHV8xNaRY3aOMx9bv22ePCNelerkSA	2026-02-17 01:06:27.524	t	::ffff:192.168.0.202	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 01:06:27.524521
34	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTI0NTkwOCwiZXhwIjoxNzcxMzMyMzA4fQ.yrUHUBled1qdFmfqfNhpojcSbMXUAuVL0pwRglmW5cA	2026-02-17 12:45:08.853	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 12:45:08.854033
36	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNDY3MTQsImV4cCI6MTc3MTMzMzExNH0.jObSBPt8LCefityGgK2J7I6m5hZsJaKQVIJYGfOwYhA	2026-02-17 12:58:34.608	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 12:58:34.608847
37	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ2OTAyLCJleHAiOjE3NzEzMzMzMDJ9.i6uGRQL2wObd-x1ZOnvJAZCn3Rj4o71mkpvFYZ5nQrM	2026-02-17 13:01:42.532	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:01:42.532718
38	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ2OTI4LCJleHAiOjE3NzEzMzMzMjh9.ernQ7I8A4vh13epxJuCma2IkLRZSMvEGkYP3hSuleV8	2026-02-17 13:02:08.028	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:02:08.028379
39	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ2OTg1LCJleHAiOjE3NzEzMzMzODV9.dvYJ0dJ9s7aSLBY_944ZuhiEwXN02gRniK511cREIJs	2026-02-17 13:03:05.957	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:03:05.957312
40	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ3MDYwLCJleHAiOjE3NzEzMzM0NjB9.a_0B64-rD75lSwBAo4vRcAhWrrCiTyCw7KE12I9VOXc	2026-02-17 13:04:20.77	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:04:20.770497
41	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ3MDgxLCJleHAiOjE3NzEzMzM0ODF9.-62hckRve1AH14TvsZtwUyTClce0CF38JNUHMURi84s	2026-02-17 13:04:41.693	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:04:41.693841
42	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ3MDg4LCJleHAiOjE3NzEzMzM0ODh9.OcZ4k4yjqEByltR-9e0Xfrmv5wACjl0ahtg0AbrBHeE	2026-02-17 13:04:48.633	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:04:48.63358
43	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ3MTAwLCJleHAiOjE3NzEzMzM1MDB9.hJwgr0BJh5F78UnOxcQyEJpS-svMOgFVMiCCI-_K40A	2026-02-17 13:05:00.041	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:05:00.041387
44	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MTQ2LCJleHAiOjE3NzEzMzM1NDZ9.jeom_KYyhPY53B19S6BYWDAF9GEBBncyH1Tx5aYVOso	2026-02-17 13:05:46.006	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:05:46.006712
45	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MTk1LCJleHAiOjE3NzEzMzM1OTV9.UkU6EPu-Z0_0gWD4oICP-sjnAvKf5gOqXnCc2ky0XJE	2026-02-17 13:06:35.596	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:06:35.597133
46	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MjQ1LCJleHAiOjE3NzEzMzM2NDV9.Rcsqm8exsC62XO_ZlnM0tLOEkEqbHWPEe5Z5bDyJOVw	2026-02-17 13:07:25.593	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:07:25.593801
47	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MjY3LCJleHAiOjE3NzEzMzM2Njd9.yiYrrmenrlf5XEeX3-yq2UYaFs4vomauS-XM0EeWAHI	2026-02-17 13:07:47.749	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:07:47.749501
48	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3Mjk2LCJleHAiOjE3NzEzMzM2OTZ9.MCJfzmMu6-4FW_QocP_eE4pX7aVWuGKexII7yN0D55w	2026-02-17 13:08:16.444	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:08:16.444827
49	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MzUwLCJleHAiOjE3NzEzMzM3NTB9.7x_p7nA58tGwqno2yIuI0Xj6eyE4VpmqMFkac41YDAM	2026-02-17 13:09:10.261	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:09:10.262247
50	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MzczLCJleHAiOjE3NzEzMzM3NzN9.5k0-ZB691hgQD9-v7pMETDDtk-Qq2UB52p9dctXci7M	2026-02-17 13:09:33.27	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:09:33.270437
51	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3MzkwLCJleHAiOjE3NzEzMzM3OTB9.G_Ka_BlWIURIEOMfcFWbMAq1A9p2smqKhh-c2luA9eo	2026-02-17 13:09:50.737	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:09:50.737865
52	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3NDE3LCJleHAiOjE3NzEzMzM4MTd9.rJ6ljWgTS26zotzaNRQL0TyrfRI3zu8iXS7AScVvyzI	2026-02-17 13:10:17.825	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:10:17.825646
53	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjQ3NDUzLCJleHAiOjE3NzEzMzM4NTN9.9aqdKEshnz0hG9D69m0nmmu-HalJWmE1anleMOrrt1A	2026-02-17 13:10:53.425	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:10:53.426078
35	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNDYxMzEsImV4cCI6MTc3MTMzMjUzMX0._VKRv3x95qE5hJzIYEQt0elsmHBHiioUo6olnKQFIRk	2026-02-17 12:48:51.907	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 12:48:51.907982
54	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTI0NzYzNiwiZXhwIjoxNzcxMzM0MDM2fQ.nluKn-jajZ_8Em86qtxK0syhPc66w2UV01a68LOhdSQ	2026-02-17 13:13:56.441	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 13:13:56.441957
55	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNDk2MTIsImV4cCI6MTc3MTMzNjAxMn0.zHKHcYSBv-7Q2nrz2kXIoGRsj6Zus52evFlMkRgijoM	2026-02-17 13:46:52.047	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:46:52.047703
56	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsImVtYWlsIjoidGlAaW5lbWVjLmNvbSIsInJvbCI6InRpIiwiaWF0IjoxNzcxMjQ5Nzg1LCJleHAiOjE3NzEzMzYxODV9.sLxOtKOpDO9NpavLhIV1a5goiHoepMvjK0D0bstqm6Y	2026-02-17 13:49:45.766	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:49:45.767047
57	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNDk4MjUsImV4cCI6MTc3MTMzNjIyNX0.kjP4-JYimSmS5_iX-kFK795Q3deWK--mVUON-MO8b1w	2026-02-17 13:50:25.015	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:50:25.016212
58	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNDk5MDcsImV4cCI6MTc3MTMzNjMwN30.9lqj2DM5AwgRbKAIFN23jU4hA4ziNmv8xwnuXZvK0LI	2026-02-17 13:51:47.102	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:51:47.102727
59	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNDk5MzYsImV4cCI6MTc3MTMzNjMzNn0.DJmRgcBCFLL-8PeTpRaU76ozu9V-W_h1gc4YTHoy48I	2026-02-17 13:52:16.017	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 13:52:16.018032
60	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTI1MDM1NiwiZXhwIjoxNzcxMzM2NzU2fQ.eB4PiOAhyBIHwz1ZpYTlGmumHcfGk0QVVgJDFPStztw	2026-02-17 13:59:16.55	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 13:59:16.550564
62	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjUxMTEyLCJleHAiOjE3NzEzMzc1MTJ9.BRvSJVuB9YKISrbjj0BIIJkDTG4ynkxTffEWhskoRyI	2026-02-17 14:11:52.288	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 14:11:52.289087
63	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjUxNjgxLCJleHAiOjE3NzEzMzgwODF9.gSRImPwbbhV4G5ds3eGk7XAeB1MYyHt_DY8RMd_TCdI	2026-02-17 14:21:21.025	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 14:21:21.026246
64	4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsImVtYWlsIjoiZ2VyZW5jaWFAaW5lbWVjLmNvbSIsInJvbCI6ImdlcmVuY2lhIiwiaWF0IjoxNzcxMjUyMTIzLCJleHAiOjE3NzEzMzg1MjN9.5PDTeLECznGyXN0E8UDZglHF_yEKJAGMBBCqQzuCGgU	2026-02-17 14:28:43.275	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-16 14:28:43.276284
61	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTI1MDQ4OSwiZXhwIjoxNzcxMzM2ODg5fQ.i4IyB7OLTYWsg54oe-oRiGDouktCW6XZsQpMhHBawQE	2026-02-17 14:01:29.893	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 14:01:29.893888
65	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTI1MzQ0MywiZXhwIjoxNzcxMzM5ODQzfQ.SVxd-IKFC_vqQznetwdPrOQhzEjR-dT6tC0u8It1E3o	2026-02-17 14:50:43.61	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 14:50:43.610554
66	7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjcsImVtYWlsIjoiaW5nLnRlY25vbG9naWEyQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNTM1NDUsImV4cCI6MTc3MTMzOTk0NX0.ssq0zcpTmq-0p__qce2tfCe6BfL4kaVYGs6F00GPb9I	2026-02-17 14:52:25.461	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 14:52:25.461303
67	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNTQxMTAsImV4cCI6MTc3MTM0MDUxMH0.dpHQQZhz_hsh3uJtok1_l_baz4Kc7YP90bFoE12cO3w	2026-02-17 15:01:50.498	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 15:01:50.499472
68	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTI1ODkwOSwiZXhwIjoxNzcxMzQ1MzA5fQ.pA6r5bvSii6_OW7LJYM8bz-MsyHw1jt1QkJLU4IdL_w	2026-02-17 16:21:49.512	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 16:21:49.512685
69	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTI1OTIwMiwiZXhwIjoxNzcxMzQ1NjAyfQ.yf0USfedQu4-BZcwnJWCDEM_60D58yE2YybADohsmKI	2026-02-17 16:26:42.951	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 16:26:42.952093
70	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTI2MDIyOSwiZXhwIjoxNzcxMzQ2NjI5fQ.Btn4WRpgUomo1asbB7fTkJiPMfgy0eBCQacP893Aycs	2026-02-17 16:43:49.403	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 16:43:49.403855
71	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyNjE1MzgsImV4cCI6MTc3MTM0NzkzOH0.XBcqSJ_CiEyGjD4-wzZNBQ0Vo-0sIFzhjrtz7gkR2MY	2026-02-17 17:05:38.562	f	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 17:05:38.563216
72	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTI2MTY1MCwiZXhwIjoxNzcxMzQ4MDUwfQ.190khW5-ZRGl-M1t8A0HkxAlodMjyUwakl_FQLAuPH8	2026-02-17 17:07:30.092	t	::ffff:192.168.0.7	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 17:07:30.093142
73	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTI3ODMxOCwiZXhwIjoxNzcxMzY0NzE4fQ.LK2shbSJ_CG-UtOmXCLsZrzoPajG5mHowto_GDlm6Mc	2026-02-17 21:45:18.665	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 21:45:18.665759
74	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEyODI0OTksImV4cCI6MTc3MTM2ODg5OX0.K0ITnGKifS80MATmq1YVoYiuITZCiTo8DMkzj9FMZnE	2026-02-17 22:54:59.182	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-16 22:54:59.183382
75	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEzNTA5NjIsImV4cCI6MTc3MTQzNzM2Mn0.j8ViXUEZcRfrTlf7rnYIWlJ5YIYAfd5Q8pb44qFAjec	2026-02-18 17:56:02.416	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-17 17:56:02.416934
76	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzEzNTI4NzYsImV4cCI6MTc3MTQzOTI3Nn0.JXOhmWHgcDaA9gIbVrQpM-RCiBB-TBPauqdQn7_76-g	2026-02-18 18:27:56.721	t	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-17 18:27:56.721572
77	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE0NDE3MjQsImV4cCI6MTc3MTUyODEyNH0.kpXZsihjvCblxQdNqitoL7dAvz2_KAF0T1DxD58Vx_s	2026-02-19 19:08:44.23	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-18 19:08:44.230227
78	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTQ0MTkwMCwiZXhwIjoxNzcxNTI4MzAwfQ.crdikfXM_TW0jHmHWTKS_4pELvP19Cm90CyDivJEV9U	2026-02-19 19:11:40.682	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-18 19:11:40.682774
79	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE0NDE5OTUsImV4cCI6MTc3MTUyODM5NX0.GI9wBJkyTszpGqzQ25WNPfga2wx_QPJp-Gg6Pdof9IU	2026-02-19 19:13:15.655	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-18 19:13:15.655193
80	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE0NDI0MzMsImV4cCI6MTc3MTUyODgzM30.XozyGdBvCTd3v3wwambSpudVm5kzCC6RiCLdPHFf1C8	2026-02-19 19:20:33.038	t	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-18 19:20:33.039157
81	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1MjkyMTcsImV4cCI6MTc3MTYxNTYxN30.qHAbdoOrsIux8N7IwjVGrZsVFbcyOL7hTmQUxrg6H5c	2026-02-20 19:26:57.127	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 19:26:57.127156
82	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTUzMjQ5MiwiZXhwIjoxNzcxNjE4ODkyfQ.KDZC2fouhNYsD9Dv5OY8ZYgAt9kp5jiM8WTja0jZhIg	2026-02-20 20:21:32.765	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 20:21:32.765619
83	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1MzMwMzEsImV4cCI6MTc3MTYxOTQzMX0.idDlYqcf-XQVepYRnPvZrlQaWZWQNJjnFnoua4iAPUM	2026-02-20 20:30:31.738	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 20:30:31.739172
84	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTUzNDI4NCwiZXhwIjoxNzcxNjIwNjg0fQ.YNFToVqG7CKBJ3FtSP1vMl16WZpchb_iUhLYJzAw48Y	2026-02-20 20:51:24.553	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 20:51:24.553877
85	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1MzQzNzYsImV4cCI6MTc3MTYyMDc3Nn0.wq-jNORN1poE_BWZmg2NQ1TJvzzsYp_mRNnyYiUurzA	2026-02-20 20:52:56.806	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 20:52:56.806627
86	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTUzNDYzOSwiZXhwIjoxNzcxNjIxMDM5fQ.5Mi1fhNXRTjKQ4IBX0oWCaLp6KjFXHDIDlxH-RbzIoU	2026-02-20 20:57:19.052	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 20:57:19.052521
87	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1MzQ4OTQsImV4cCI6MTc3MTYyMTI5NH0.5zBELjrgKgo6p-aJyp5UerjutYg89PYANpvXscHV7o4	2026-02-20 21:01:34.74	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 21:01:34.740459
88	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1MzUyNzcsImV4cCI6MTc3MTYyMTY3N30.wBB078safDXzNgfIzaAzB8nTWsN-5rTV_y0xfNlDfDk	2026-02-20 21:07:57.123	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 21:07:57.123406
89	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTUzNjAwNCwiZXhwIjoxNzcxNjIyNDA0fQ.UsntYVcy_1WZoLkWiQFPx5Xf1DwhRWlXznRPFopgKtw	2026-02-20 21:20:04.917	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 21:20:04.918393
90	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1MzY0NzYsImV4cCI6MTc3MTYyMjg3Nn0.NtPYvUuJD90M-mwxvovnVkV-FR-F3Edv_SZJczZHp_4	2026-02-20 21:27:56.661	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-19 21:27:56.661878
91	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NDkwMTMsImV4cCI6MTc3MTYzNTQxM30.RLXl8berdW1isH6aplczScgGJ19W8Bjtq9zcKU8y-2c	2026-02-21 00:56:53.96	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 00:56:53.96116
92	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NTEwODIsImV4cCI6MTc3MTYzNzQ4Mn0.oS6v3etTT-XeF8EQA5XQzZjIOtFEOkdLu52Ss9Q7uhE	2026-02-21 01:31:22.515	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 01:31:22.515798
93	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU1MjQ0OCwiZXhwIjoxNzcxNjM4ODQ4fQ.Zy0NwxRAE7B4sVMljd94N79Bia7zYP2vIQXWAxjr9XA	2026-02-21 01:54:08.253	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 01:54:08.253671
94	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NTI0NzEsImV4cCI6MTc3MTYzODg3MX0.YcAEjIQe59YmzZNalkVLOJocnm12wdI8-6pw4HsJK4s	2026-02-21 01:54:31.428	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 01:54:31.428366
95	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU1MjgzNCwiZXhwIjoxNzcxNjM5MjM0fQ.ZVsk0d0ABuZrNfVlgZzahfhBtm8sQBGdav50gAAeiT4	2026-02-21 02:00:34.016	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 02:00:34.016225
96	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU1NDE5MiwiZXhwIjoxNzcxNjQwNTkyfQ.QHoQ9QTcPLlJxCZ_LEFhuhw64FouMcNNDs0wt1Yey1g	2026-02-21 02:23:12.022	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 02:23:12.022312
97	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU1ODUxNCwiZXhwIjoxNzcxNjQ0OTE0fQ.SCobpDTWqjP7r4iwWRQF5G3t9pm5712ilCzlhisJGbE	2026-02-21 03:35:14.574	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:35:14.575561
98	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU1ODUzOCwiZXhwIjoxNzcxNjQ0OTM4fQ.02vCN-6YlkUGgwLuNoIMqBYsJiYUhcimITedz1Y9REQ	2026-02-21 03:35:38.913	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:35:38.914568
99	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NTg1MzksImV4cCI6MTc3MTY0NDkzOX0.uyK7QwkB8WhKXomFDhmD6q2ZA4Tfu7TjaEC0rUvi4yI	2026-02-21 03:35:39.051	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:35:39.051372
100	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU1ODUzOSwiZXhwIjoxNzcxNjQ0OTM5fQ.X7am8BjNhlIymS56GtFMhjJF2h9Qh8cOVFqyymzqo3I	2026-02-21 03:35:39.173	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:35:39.173606
101	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU1OTI5NCwiZXhwIjoxNzcxNjQ1Njk0fQ.Oz5bIvZtDrtopvicUNucOBrWz2yUhyamCB_vhKpErxk	2026-02-21 03:48:14.813	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:48:14.813533
102	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU1OTM3MSwiZXhwIjoxNzcxNjQ1NzcxfQ.zc0LOUqeIx_0aLMAk8PSOe-ie7nktxP72PITh-aTyIo	2026-02-21 03:49:31.498	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:49:31.498534
103	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NTkzNzEsImV4cCI6MTc3MTY0NTc3MX0.ySgF3hzFX6gJHQJDl9-Ugf4WHwdFJ2DfDGBQxdNkRTk	2026-02-21 03:49:31.603	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:49:31.60389
104	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU1OTM3MSwiZXhwIjoxNzcxNjQ1NzcxfQ.JLXCIZ45DaNlr_6Ix5YmuOJsDe4Atyq2Hs1Sy89lskw	2026-02-21 03:49:31.71	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 03:49:31.710976
105	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU2MDE3NCwiZXhwIjoxNzcxNjQ2NTc0fQ.kEYCBKDRmIn4ZatX7dEPiaakjD4SwqrxTQSXcgkwCuk	2026-02-21 04:02:54.923	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 04:02:54.924359
106	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NjAyMjEsImV4cCI6MTc3MTY0NjYyMX0._YR2iFxQOqr2Kb8zP6WolGC4VGfM4tZ6FxglBPAoweY	2026-02-21 04:03:41.081	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 04:03:41.08218
107	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NjAyNzgsImV4cCI6MTc3MTY0NjY3OH0.z1VGmQfhK4xZ4k-n59yB0zb2nYy7rIXt6-JAdEWu9wU	2026-02-21 04:04:38.697	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 04:04:38.697739
108	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NjA2MjgsImV4cCI6MTc3MTY0NzAyOH0.FSeKqtL8WoMwlE7ERx0SfZp_8SGQeMWpw2NbpV7MauA	2026-02-21 04:10:28.231	t	::ffff:172.26.0.1	curl/8.5.0	2026-02-20 04:10:28.231943
109	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU2MzA4OSwiZXhwIjoxNzcxNjQ5NDg5fQ.kBGjdA5jxJsjaJnsnadddtcXgYyBAFuwhXjGtQjp4iU	2026-02-21 04:51:29.358	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 04:51:29.358845
110	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NjMyMjYsImV4cCI6MTc3MTY0OTYyNn0.N5a2e5k-XX3_BeI4rUPaYmWPwXPzLK4HkswP9ughUEE	2026-02-21 04:53:46.891	t	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 04:53:46.891728
111	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NjYyODAsImV4cCI6MTc3MTY1MjY4MH0.txZHiaCXftXqrpxJVNPcUenAsXMegWz1ErMjeWzRuLc	2026-02-21 05:44:40.378	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 05:44:40.379171
112	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU2ODg4NywiZXhwIjoxNzcxNjU1Mjg3fQ.BBpgi1uoXdnX1f2TZWeV-xZtOVIQkEpEV-vWwJWZDVE	2026-02-21 06:28:07.617	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 06:28:07.618573
113	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1Njg5NTcsImV4cCI6MTc3MTY1NTM1N30.LYAZnTbUA8PLy2Oj_GVl1a_XJ80u55QnUbLhdcJ38lo	2026-02-21 06:29:17.514	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 06:29:17.514576
114	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU3MDM4OSwiZXhwIjoxNzcxNjU2Nzg5fQ.fH26IK-lCmErmdMKkvNxJx9vZQdx1Yf9bsNJ7TpP46s	2026-02-21 06:53:09.539	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 06:53:09.539238
115	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NzA0MjQsImV4cCI6MTc3MTY1NjgyNH0.XHRhFhEOtxMCp7mQk14a06XNJPI3DWF6sOy91wivlJo	2026-02-21 06:53:44.003	t	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 06:53:44.00396
116	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NzA5MzIsImV4cCI6MTc3MTY1NzMzMn0.yVs9ovJNq5oeL-yd6Ie3-cr2SN02iyrEns6fBiMI_bU	2026-02-21 07:02:12.502	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 07:02:12.503191
117	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU3MjIxMywiZXhwIjoxNzcxNjU4NjEzfQ.Gp_sT0ao5wxACSJkxXyBFdNgZI6hkiChxvbK9-b8h4g	2026-02-21 07:23:33.484	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 07:23:33.484394
118	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NzIyMzYsImV4cCI6MTc3MTY1ODYzNn0.ak0OCAgcKXifyKQoJNI5WFitwCgNBZ0GSmd-wdyTZis	2026-02-21 07:23:56.894	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 07:23:56.894571
119	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksImVtYWlsIjoicHJvLmF1dG9tYXRpemFjaW9uQGluZW1lYy5jb20iLCJyb2wiOiJ0aSIsImlhdCI6MTc3MTU3MjI2NSwiZXhwIjoxNzcxNjU4NjY1fQ.DrrNH1R7zbDueTJwHO2gFXR1ivnCOIXpF9mi1bZEARw	2026-02-21 07:24:25.117	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 07:24:25.118022
120	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NzIzMDMsImV4cCI6MTc3MTY1ODcwM30.wcWaKh8HIy3O2CrLVjhJh0dINVQuaykfo-n5cpzO_58	2026-02-21 07:25:03.733	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 07:25:03.73408
121	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1NzUyNzIsImV4cCI6MTc3MTY2MTY3Mn0.ni9aTkd7Zii0JTLgzfEUPNLOX5nt57iI1m8FKYvY2pw	2026-02-21 08:14:32.177	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 08:14:32.178368
122	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU3NzYwNSwiZXhwIjoxNzcxNjY0MDA1fQ.W7CMsE8XSFM9NaFH5A1T1BaClRBa-CBEprqh2i6Pojs	2026-02-21 08:53:25.656	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 08:53:25.65785
123	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1Nzc4OTUsImV4cCI6MTc3MTY2NDI5NX0.YyVlqchpERIMe56sEYRS4JUhPNd-oUDwZIJ13Y2DG6A	2026-02-21 08:58:15.714	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 08:58:15.714873
124	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU3ODA3MywiZXhwIjoxNzcxNjY0NDczfQ.JJI6gK2pCjsvPiG-jlfcjoNKRq4bpzeNMW7cAvDj64s	2026-02-21 09:01:13.399	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 09:01:13.399605
125	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1ODMxMDksImV4cCI6MTc3MTY2OTUwOX0.QaseGYyjMYXtooU5tn_iqjjI6Kd69p4yslD4aCXck1A	2026-02-21 10:25:09.467	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 10:25:09.467748
126	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU4MzI2MywiZXhwIjoxNzcxNjY5NjYzfQ.X03xV_BzcX0vx-EGy3y_FAQK_1Iw6H5CScU7vHp6Ar8	2026-02-21 10:27:43.067	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 10:27:43.067475
127	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1ODMzNTgsImV4cCI6MTc3MTY2OTc1OH0.mo_nsgdgjH3dk31Gdjsgrus9F95JkJZotTH8LKszW8o	2026-02-21 10:29:18.588	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 10:29:18.588575
128	7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjcsImVtYWlsIjoiaW5nLnRlY25vbG9naWEyQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1ODM5MDQsImV4cCI6MTc3MTY3MDMwNH0.O6Cy8URZtcaEMDnuW2s2W2MfJZIZK6R2l-umInps_-U	2026-02-21 10:38:24.212	t	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 10:38:24.212923
129	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1ODM5NjIsImV4cCI6MTc3MTY3MDM2Mn0.MED5ezA4RTJjvDJdzwtnICADXpWa8843OEB2YhiJPes	2026-02-21 10:39:22.935	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 10:39:22.935569
130	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU4NzM1MSwiZXhwIjoxNzcxNjczNzUxfQ.PULoCcSICxVjgz3fRm4h3O3aFC6eStWIbbeRAdpGZhk	2026-02-21 11:35:51.737	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 11:35:51.737749
131	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1ODc5NDgsImV4cCI6MTc3MTY3NDM0OH0.cV4VRrZ-WK1ibpI_gc1STu4ospudjfsAJkEaxAoUFOg	2026-02-21 11:45:48.35	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 11:45:48.350861
132	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU4ODA0MiwiZXhwIjoxNzcxNjc0NDQyfQ.TpecQsrK-ajVdBmRFRZEsi1hx6s_CLCNxxAhEucn9EY	2026-02-21 11:47:22.619	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 11:47:22.619974
133	5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImVtYWlsIjoiaW5nLnRlY25vbG9naWExQGluZW1lYy5jb20iLCJyb2wiOiJudWV2YXNfdGVjbm9sb2dpYXMiLCJpYXQiOjE3NzE1ODgxNDEsImV4cCI6MTc3MTY3NDU0MX0.1bmLAACR1iDGtbZyazsOcOWHxH_BC-YevJRJFOBn5vc	2026-02-21 11:49:01.388	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 11:49:01.388758
134	6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoiZG9yYWluLmNlbGlzQGluZW1lYy5jb20iLCJyb2wiOiJnZXJlbmNpYSIsImlhdCI6MTc3MTU4ODI5MSwiZXhwIjoxNzcxNjc0NjkxfQ.Zni0ugoN_PXO6dZiAwZMqb87f_U5jlRDf-tjhjE93gk	2026-02-21 11:51:31.247	f	::ffff:192.168.0.12	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-02-20 11:51:31.248217
\.


--
-- Data for Name: sesiones_solicitante; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.sesiones_solicitante (id, solicitante_id, token, expira_en, activa, creado_en) FROM stdin;
1	1	52c3c59b5a5cf2a1ae5be8419da652126e638b83b86f2cb55ec0a0245ee3a906	2026-02-12 18:28:06.941	t	2026-02-12 16:28:06.942005
2	1	3d6c8c9ee0c3332d8f6512c8cec5b16d12394f4c0de070c2d9f7b7dcaecd4725	2026-02-12 19:58:46.739	t	2026-02-12 17:58:46.739744
3	1	a87fa2ebd13bca4b11374a908282e4cb26bd007b24745ebe2ee35bbf5b53fb05	2026-02-12 21:03:14.899	t	2026-02-12 19:03:14.899707
4	1	6e6389937ca2604e437b86ee36410c932999d9ef24562e109db7d1ab60cb7761	2026-02-12 21:10:01.761	t	2026-02-12 19:10:01.762404
5	1	77206d791b3de4fcd7bf18af35e797e2615a331c1953753dd627c74114ca1012	2026-02-15 16:17:22.742	t	2026-02-15 14:17:22.742342
6	1	7cc07472c59258ed22564cad08a2855e8746804a6d00b919863adb755154acc0	2026-02-15 16:50:47.984	t	2026-02-15 14:50:47.984614
7	1	220382f122d49e5f30266ba61abb583fa10842ee7b82692f400998b6043d30e9	2026-02-15 16:55:55.23	t	2026-02-15 14:55:55.231212
8	1	d88d4a516bccbec6f835cd6904a6bc56bf8360f28a49fcf96bb6ffbc9fd02196	2026-02-15 17:00:01.667	t	2026-02-15 15:00:01.667803
9	1	e14f8c102273766bf8c78497f44db53a84860cecbd91eb29a7bb74512011b4b7	2026-02-16 14:20:51.963	t	2026-02-16 12:20:51.964121
10	1	058b63ea6d6562ebe862fff67c3242b64bff7e5c04862b0acc16dcbb198222d4	2026-02-16 14:23:58.62	t	2026-02-16 12:23:58.621347
11	1	29ab90707d7ab1429dc260bfcd6e29112709d3627a7322d1c67f446ddaefbf59	2026-02-16 14:36:38.127	t	2026-02-16 12:36:38.128063
12	1	cf5a7f8f6153586592c84ea801be29c6fd9ee34600f1e8917b3eaab6acd8f3c3	2026-02-16 14:41:16.966	t	2026-02-16 12:41:16.967048
13	1	00bbd79c1cf98aa1926eec3c1920a17db520e5ba8d736dd790c92208c04985b5	2026-02-16 14:43:30.861	t	2026-02-16 12:43:30.861939
14	1	986c386d6735371a5ba3c4ed94773df9acdb5320da9450fe2a4350509d763c1a	2026-02-16 18:25:32.626	t	2026-02-16 16:25:32.626911
15	1	7124acfa4334c52646dffc17b8b400fe676d26c8d84aa4204df6bef7dea2a4b2	2026-02-16 19:03:32.162	t	2026-02-16 17:03:32.163353
16	1	fb4f0ed6c76f44ccc1bda1c0a13a76c282d0a7603e7172b4e129e18326d4fa5c	2026-02-17 19:51:04.188	t	2026-02-17 17:51:04.188378
17	17	a6262babc8801968e77aa000db7d50f61f384a79798199e3c1a1f479959b5666	2026-02-17 20:02:11.885	t	2026-02-17 18:02:11.885641
18	1	2527cd7d2107556b9934aeebb092aec8229e7e0c557ffd6c3f28bf9a6c4e38ae	2026-02-18 21:06:51.274	t	2026-02-18 19:06:51.275027
19	1	982c09980295411adba56208a59ad990f8288e7a6488e1639e11033daa7981ab	2026-02-19 22:13:21.117	t	2026-02-19 20:13:21.117532
20	1	2fbbfb50c83ed4f871dad521ff370a825d9987dc56adb11f1117827f35ece581	2026-02-19 22:29:02.422	t	2026-02-19 20:29:02.422531
21	1	6f705e0e42c9541e9ad3c17610eeff54a86c139210bc88ea819da1054ab0e84b	2026-02-20 04:14:37.855	t	2026-02-20 02:14:37.85559
22	1	ed1d915301d99c7af46028f8eba8cfbe580e2a560a986f3b05f9ccbd9bf46457	2026-02-20 04:25:00.897	t	2026-02-20 02:25:00.898127
23	23	555b4eec4b723f2528d7242d5e98e3862c5902758acfad6b2c6bd49512ce75a1	2026-02-20 05:21:26.127	t	2026-02-20 03:21:26.127811
24	24	df060422faea3131a0fe603be9c856da54ad280a54b70c1884f977bb1c516156	2026-02-20 05:21:31.674	t	2026-02-20 03:21:31.67446
25	25	34472a2f103d5e14a25c3def5d907009ae470050f0b4d4430b9f1b531b455cdf	2026-02-20 05:22:36.528	t	2026-02-20 03:22:36.529566
26	26	526a87963d82b0ab8bdaacff04515fd26f3c66dd99175dc43acae7558e2a932c	2026-02-20 05:28:10.597	t	2026-02-20 03:28:10.598149
27	27	b8f1b13518bb80652f80e0a1400ccd2c8e0c297341703a8721f5a8bf13da0632	2026-02-20 05:30:16.711	t	2026-02-20 03:30:16.711273
28	28	448e3b05deafaa4eafbc33fbd549b0ce8c7e76723b1a1e75b82f1a0c3174529d	2026-02-20 05:32:47.492	t	2026-02-20 03:32:47.493141
29	29	1601c7da8d40ba55b3be0be1986da318dbe40b4ed60bc632612d24b4ea0613e9	2026-02-20 05:33:12.045	t	2026-02-20 03:33:12.045961
30	30	734dee5837ab1b6a130e539b69c702a3403e61d1215f821dfd073d9f6651ff51	2026-02-20 05:36:03.215	t	2026-02-20 03:36:03.216043
31	31	d674ac0a2203591c1a9d69b03f855a5ca61887fab90f0a98180934fa18d94f8b	2026-02-20 06:11:40.665	t	2026-02-20 04:11:40.666305
32	32	3d32781c66339be2e5a7dcc28849573b3fea2c3d819f4156541f9d2c13797df1	2026-02-20 06:25:55.831	t	2026-02-20 04:25:55.832024
33	33	672b91493ed15482d825c488bc5b8c4037ab7efc0bcc3a839f4fc8ec476ba231	2026-02-20 06:34:48.789	t	2026-02-20 04:34:48.790114
34	34	e81ddeca7c7505368ac90214f3dd35e85fc89730bda4195269d3e6a403d6b9bd	2026-02-20 06:35:08.966	t	2026-02-20 04:35:08.966735
35	35	4f5cf020526364980392c20e4b0ee99bf770b33670067e33c080bf360ce426a3	2026-02-20 06:40:18.463	t	2026-02-20 04:40:18.464512
36	36	0dc8ef4c6fce93bbdb0fbcc0b984539e11baaa4bd5e55cfb297351f825688478	2026-02-20 06:40:40.268	t	2026-02-20 04:40:40.269862
37	37	0e0bc624c2b46e1ee185fa3d91559a13da09898fab3a30d3124759c53847930f	2026-02-20 06:45:22.582	t	2026-02-20 04:45:22.58279
38	38	1d56f1ecb26f20416a05b9fafdd62e224adb2e0beddcaa53434b397190bfbc38	2026-02-20 06:47:20.761	t	2026-02-20 04:47:20.761837
39	39	57dfc099a3e02a4ec444122bee2508864dc7b2d38e6377c4b17c1fca02a96d10	2026-02-20 06:48:19.839	t	2026-02-20 04:48:19.839368
40	39	d7bc0030518ecb2137f7cec9953796b266ad3cf675d311f22930d1a25e3ef3ce	2026-02-20 06:50:09.526	t	2026-02-20 04:50:09.526847
41	41	d50ddb948669aa782171909763bccc0720d21c1d7844d259ff2d956234bf7f0d	2026-02-20 07:06:53.735	t	2026-02-20 05:06:53.73649
42	42	b8ac6767de17295f497b765d6602f44d573f33279dd24daa77ba31af037b7622	2026-02-20 07:12:14.552	t	2026-02-20 05:12:14.553605
\.


--
-- Data for Name: solicitantes; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.solicitantes (id, email, nombre, verificado, ultima_verificacion, creado_en) FROM stdin;
17	gte.comercial@inemec.com	Gabriel Fernando Cordoba	t	\N	2026-02-17 18:02:11.878737
1	andreskks998@gmail.com	test2	t	2026-02-20 02:25:00.871762	2026-02-12 16:28:06.928206
23	ghoio@inemec.com	hoihil	t	\N	2026-02-20 03:21:26.104838
24	test@inemec.com	Test Usuario	t	\N	2026-02-20 03:21:31.658798
25	crtvyb@inemec.com	ctvybunimo	t	\N	2026-02-20 03:22:36.503705
26	test2@inemec.com	Test Usuario 2	t	\N	2026-02-20 03:28:10.575192
27	buhnijm@inemec.com	unimo,	t	\N	2026-02-20 03:30:16.678591
28	yubn@inemec.com	ybunm	t	\N	2026-02-20 03:32:47.467729
29	difie@inemec.com	binom	t	\N	2026-02-20 03:33:12.023825
30	comprehensive.test@inemec.com	Test Comprehensive	t	\N	2026-02-20 03:36:03.197022
31	gyhiuo@inemec.com	g78hj	t	\N	2026-02-20 04:11:40.634069
32	hiujo@inemec.com	tyfguin	t	\N	2026-02-20 04:25:55.808091
33	inm@google.com	ugyih	t	\N	2026-02-20 04:34:48.768324
34	bhjnk@gmail.com	inlm	t	\N	2026-02-20 04:35:08.939895
35	gyuhij@gmail.com	ghijom	t	\N	2026-02-20 04:40:18.431906
36	uimo@gmail.com	nmñ,	t	\N	2026-02-20 04:40:40.256936
37	hiujo@hotmail.com	ihuoj	t	\N	2026-02-20 04:45:22.557316
38	guyhino@yahhoo.com	ugyihnom	t	\N	2026-02-20 04:47:20.735453
39	ubinom@inemec.com	uygbinom	t	2026-02-20 04:50:09.508134	2026-02-20 04:48:19.81594
41	jo@k.com	hojo	t	\N	2026-02-20 05:06:53.709358
42	fhjeo@fja.co	jfkñs	t	\N	2026-02-20 05:12:14.526022
\.


--
-- Data for Name: solicitudes; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.solicitudes (id, codigo, tipo, estado, prioridad, titulo, solicitante_id, usuario_creador_id, evaluador_id, datos_solicitante, datos_patrocinador, datos_stakeholders, descripcion_problema, necesidad_urgencia, solucion_propuesta, beneficios, kpis, declaracion, motivo_rechazo, creado_en, actualizado_en, fecha_inicio_agendada, fecha_fin_estimada, reevaluaciones_count, transferido_a_ticket_id, origen_ticket_id, resolucion, fecha_resolucion, fecha_inicio_programada, fecha_fin_programada, proyecto_referencia, fecha_inicio_desarrollo, dias_pausados_total, motivo_cancelacion, cancelado_en, cancelado_por) FROM stdin;
14	SOL-2026-0014	reporte_fallo	pendiente_evaluacion_nt	alta	Error en sistema de facturacion	24	\N	\N	{"area": "Finanzas", "cargo": "Contadora", "cedula": "87654321", "correo": "test@inemec.com", "telefono": "3009876543", "es_doliente": true, "nombre_completo": "Maria Garcia Test", "operacion_contrato": "INEMEC Corporativo"}	{}	{}	{"titulo": "Error en sistema de facturacion al generar reportes mensuales", "descripcion": "Al intentar generar el reporte mensual de enero, el sistema muestra error 500. El problema ocurre cuando hay mas de 1000 facturas en el periodo."}	{"urgencia": "alta", "justificacion": "Necesitamos el reporte para la reunion con gerencia manana"}	{}	{}	[]	{}	\N	2026-02-20 03:25:47.057585	2026-02-20 03:25:47.057585	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
15	SOL-2026-0015	cierre_servicio	pendiente_evaluacion_nt	media	Cierre del sistema legacy de inventarios	24	\N	\N	{"area": "Operaciones", "cargo": "Analista de Procesos", "cedula": "11223344", "correo": "test@inemec.com", "telefono": "3001112233", "es_doliente": false, "nombre_completo": "Carlos Rodriguez Test", "operacion_contrato": "INEMEC Corporativo"}	{}	{}	{"titulo": "Cierre del sistema legacy de inventarios", "descripcion": "El sistema de inventarios legacy fue reemplazado por SAP. Ya no hay usuarios activos desde hace 6 meses. Todos los datos fueron migrados exitosamente."}	{}	{}	{}	[]	{"confirmacion": true}	\N	2026-02-20 03:26:18.533119	2026-02-20 03:26:18.533119	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
16	SOL-2026-0016	cierre_servicio	pendiente_evaluacion_nt	baja	Cierre de portal de reportes antiguo	24	\N	\N	{"area": "Tecnologia", "cargo": "Jefe de Proyectos", "cedula": "22334455", "correo": "test@inemec.com", "telefono": "3002223344", "es_doliente": true, "nombre_completo": "Sofia Lopez Test", "operacion_contrato": "INEMEC Corporativo"}	{}	{}	{"titulo": "Cierre de portal de reportes antiguo", "descripcion": "El portal de reportes fue reemplazado por PowerBI. Ya no tiene usuarios activos y los costos de mantenimiento son innecesarios."}	{}	{}	{}	[]	{"confirmacion": true}	\N	2026-02-20 03:26:34.969133	2026-02-20 03:26:34.969133	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
4	SOL-2026-0004	reporte_fallo	transferido_ti	alta	Test: Fallo en sistema de prueba	\N	\N	\N	{"email": "test@test.com", "nombre": "Test User"}	{}	[]	{"descripcion": "Sistema falla al iniciar"}	{}	{}	{}	[]	{}	\N	2026-02-16 02:52:52.187827	2026-02-16 02:53:31.003772	\N	\N	0	7	\N	Transferido a TI. Nuevo ticket: TKT-202602-0002. Motivo: Este fallo requiere soporte TI directo	2026-02-16 02:53:31.003772	\N	\N	{}	\N	0	\N	\N	\N
1	SOL-2026-0001	proyecto_nuevo_interno	agendado	alta	Sistema de gestión de inventarios para bodega	1	\N	5	{"area": "gerencia_general", "cargo": "test Cargo", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Test", "operacion_contrato": "oficina_principal"}	{}	{"internas": {}}	{"origen": "test origin", "impacto_nivel": "baja", "situacion_actual": "test desc", "impacto_descripcion": "test impact", "afectacion_operacion": "test effect", "procesos_comprometidos": "test process"}	{"nivel": "corto_plazo", "justificacion_nt": "NT", "necesidad_principal": "test necesity"}	{"funcionalidades_minimas": ["Test function"]}	{"descripcion": "test benefit", "mejora_concreta": "Test mejora"}	[]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-15 14:53:04.29566	2026-02-20 00:57:23.357276	\N	\N	0	\N	\N	\N	\N	2026-04-01	2026-06-30	{}	\N	0	\N	\N	\N
2	SOL-2026-0002	reporte_fallo	descartado_nt	critica	Error crítico en módulo de facturación	1	\N	5	{"area": "gerencia_general", "cargo": "it", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "andres Pérez", "operacion_contrato": "oficina_principal"}	{}	{}	{"descripcion": "fallo fallo fallo fallo"}	{"urgencia": "critica", "justificacion": "para operacion"}	{}	{}	[]	{}	\N	2026-02-15 15:01:15.305057	2026-02-20 00:57:23.365579	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
3	SOL-2026-0003	cierre_servicio	descartado_nt	media	Cierre de sistema legacy de nómina	1	\N	5	{"area": "gerencia_general", "cargo": "it", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Jesus", "operacion_contrato": "oficina_principal"}	{}	{}	{"descripcion": "cierre cierre cierre"}	{}	{}	{}	[]	{"confirmacion": true}	\N	2026-02-15 15:02:14.700744	2026-02-20 00:57:23.369201	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
8	SOL-2026-0008	reporte_fallo	descartado_nt	critica	Fallo en sincronización de datos ERP	\N	5	5	{"area": "nuevas_tecnologias", "cargo": "nt", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andres Perez", "operacion_contrato": "contrato_gran_tierra"}	{}	{}	{"descripcion": "jfjoeinamfñmpoeajmfñmañfmeopf"}	{"urgencia": "critica", "justificacion": "jfoejajfpa"}	{}	{}	[]	{}	\N	2026-02-16 12:41:59.807807	2026-02-20 00:57:23.386302	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
9	SOL-2026-0009	cierre_servicio	descartado_nt	media	Cierre de aplicación de control de acceso antigua	\N	5	5	{"area": "ti", "cargo": "hspofjjpejfpoeopjf", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "jesus cotes", "operacion_contrato": "contrato_oxy"}	{}	{}	{"descripcion": "nflejnalfl\\nnfleanlfnla"}	{}	{}	{}	[]	{"confirmacion": true}	\N	2026-02-16 12:44:31.077443	2026-02-20 00:57:23.389909	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
5	SOL-2026-0005	transferido_ti	completado	media	[Transferido de TKT-202602-0001] Configuración de equipo nuevo	\N	5	7	{}	{}	[]	{"ticket_origen": "TKT-202602-0001", "descripcion_original": "Descripcion del ticket original", "motivo_transferencia": "Requiere desarrollo"}	{}	{}	{}	[]	{}	\N	2026-02-16 02:53:53.099338	2026-02-20 00:57:51.066506	\N	\N	0	\N	1	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
17	SOL-2026-0017	proyecto_nuevo_interno	pendiente_evaluacion_nt	alta	Sistema de gestion de contratos	26	\N	\N	{"area": "Legal", "cargo": "Analista Legal", "cedula": "33445566", "correo": "test2@inemec.com", "telefono": "3003334455", "es_doliente": false, "nombre_completo": "Roberto Mendez Test", "operacion_contrato": "INEMEC Corporativo"}	{"area": "Legal", "cargo": "Directora Legal", "cedula": "99887766", "correo": "sponsor.legal@inemec.com", "nombre_completo": "Patricia Ruiz Sponsor", "operacion_contrato": "INEMEC Corporativo"}	{"externas": {"empresas": ["Proveedores principales"], "personas": ["Representantes legales"], "sectores": ["Proveedores", "Clientes"]}, "internas": {"areas": ["Legal", "Finanzas", "Operaciones"], "personas": ["Gerente Legal", "Contador Principal"]}, "aplica_externas": true}	{"origen": "Crecimiento de la empresa y aumento de contratos ha hecho inmanejable el proceso manual.", "titulo": "Sistema de gestion de contratos", "impacto_nivel": "alta", "situacion_actual": "Actualmente los contratos se manejan en carpetas fisicas y archivos Excel. Es dificil hacer seguimiento a vencimientos.", "impacto_descripcion": "Riesgo de multas por incumplimiento de contratos y perdida de clientes importantes", "afectacion_operacion": "Se han perdido oportunidades de renovacion por falta de seguimiento. Riesgo legal.", "procesos_comprometidos": "Renovaciones, auditorias, reportes gerenciales, cumplimiento legal"}	{"nivel": "corto_plazo", "justificacion_nt": "Tenemos auditorias programadas en 2 meses y necesitamos orden en los contratos", "necesidad_principal": "Centralizar y automatizar el seguimiento de contratos"}	{"funcionalidades_minimas": ["Registro de contratos", "Alertas de vencimiento", "Dashboard de estado", "Busqueda avanzada"]}	{"descripcion": "Reduccion de riesgo legal, mejor control de vencimientos, reportes automatizados", "mejora_concreta": "Eliminacion de renovaciones perdidas y multas por incumplimiento", "reduccion_costos": true, "reduccion_costos_descripcion": "Ahorro estimado de 50M COP anuales en multas evitadas"}	[{"nombre": "Contratos vencidos sin renovar", "valor_actual": "15%", "valor_objetivo": "0%"}, {"nombre": "Tiempo de busqueda de contrato", "valor_actual": "30 min", "valor_objetivo": "2 min"}]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-20 03:28:10.624521	2026-02-20 03:28:10.624521	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
18	SOL-2026-0018	proyecto_nuevo_interno	pendiente_evaluacion_nt	media	App movil para reportes de campo	26	\N	\N	{"area": "Operaciones", "cargo": "Gerente de Operaciones", "cedula": "44556677", "correo": "test2@inemec.com", "telefono": "3004445566", "es_doliente": true, "nombre_completo": "Fernando Castro Test", "operacion_contrato": "INEMEC Corporativo"}	{}	{"internas": {"areas": ["Operaciones", "Tecnologia"], "personas": ["Supervisores de campo", "Coordinadores"]}, "aplica_externas": false}	{"origen": "Proceso manual anticuado que no escala con el crecimiento del equipo de campo.", "titulo": "App movil para reportes de campo", "impacto_nivel": "media", "situacion_actual": "Los reportes de campo se hacen en papel y luego se digitan. Hay errores y demoras.", "impacto_descripcion": "Ineficiencia operativa y toma de decisiones con informacion desactualizada", "afectacion_operacion": "Demoras de hasta 3 dias en tener informacion actualizada de campo.", "procesos_comprometidos": "Reportes diarios, seguimiento de tareas, control de calidad"}	{"nivel": "mediano_plazo", "justificacion_nt": "Podemos esperar pero entre mas pronto mejor para la eficiencia", "necesidad_principal": "Digitalizar los reportes de campo con app movil"}	{"funcionalidades_minimas": ["Formularios offline", "Captura de fotos", "GPS", "Sincronizacion automatica"]}	{"descripcion": "Informacion en tiempo real, menos errores de digitacion, mejor trazabilidad", "mejora_concreta": "Reduccion del tiempo de reporte de 3 dias a tiempo real", "reduccion_costos": false}	[{"nombre": "Tiempo promedio de reporte", "valor_actual": "3 dias", "valor_objetivo": "30 min"}]	{"confirmo_informacion": true}	\N	2026-02-20 03:28:32.652225	2026-02-20 03:28:32.652225	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
22	SOL-2026-0022	reporte_fallo	pendiente_evaluacion_nt	critica	VERIFY: Error de nomina	30	\N	\N	{"area": "RRHH", "cargo": "Analista", "cedula": "45678901", "correo": "ana@inemec.com", "es_doliente": true, "nombre_completo": "Ana Perez", "operacion_contrato": "INEMEC"}	{}	{}	{"titulo": "Error de nomina SAP", "descripcion": "Error NM-4520 bloquea calculo de prenomina en SAP."}	{"urgencia": "critica", "justificacion": "Nomina debe pagarse pronto"}	{}	{}	[]	{}	\N	2026-02-20 03:45:25.570827	2026-02-20 03:45:25.570827	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
7	SOL-2026-0007	actualizacion	en_estudio	alta	Actualización módulo de reportes financieros	\N	5	5	{"area": "gerencia_general", "cargo": "nt", "cedula": "1005257395", "correo": "Andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andrés Pérez", "operacion_contrato": "oficina_principal"}	{}	{"externas": {"empresas": ["sjdkla"], "personas": ["jdklasd"], "sectores": ["djklfk"], "proveedores": ["sdjdl"]}, "internas": {"areas": ["ajdk"], "personas": ["adjk"]}, "aplica_externas": true}	{"origen": "jfsjf", "evidencia": [{"uid": "rc-upload-1771245330623-7", "name": "CV_Andres_Perez_English.pdf", "size": 112850, "status": "done", "originFileObj": {"uid": "rc-upload-1771245330623-7"}}], "fecha_inicio": "2026-02-14T05:00:00.000Z", "impacto_nivel": "critica", "situacion_actual": "djklfjl", "impacto_descripcion": "jflkafjl", "afectacion_operacion": "jflkjfl", "procesos_comprometidos": "jflksfl"}	{"nivel": "corto_plazo", "fecha_limite": "2026-02-20T05:00:00.000Z", "justificacion_nt": "jflkslf", "necesidad_principal": "jflkslf"}	{"tipo": "reporte_dashboard", "casos_uso": "jfsafjpoejpoajmñfojonevibnihbiuhaisjnjaeifohnijoqj\\nfjoieajjm\\ndjiafjña\\nflsjfljfña\\nfjsajfñjñ\\nsjflajf", "referencias": [{"uid": "rc-upload-1771245330623-9", "name": "CV_Andres_Perez_Espanol.pdf", "size": 112468, "status": "done", "originFileObj": {"uid": "rc-upload-1771245330623-9"}}], "forma_entrega": "movil", "restricciones": ["jfeopaf"], "tipo_descripcion": "jfklfjl", "usuarios_finales": ["jfñfj", "jfejfl", "jeiofjoe"], "descripcion_ideal": "fjlksjafljsflaj", "tiene_restricciones": true, "funcionalidades_minimas": ["feje", "iojaefoj", "jeifojoa"], "funcionalidades_deseables": ["jefljaleflñ"]}	{"descripcion": "jfejapñef", "mejora_concreta": "jefñajñfe", "reduccion_costos": true, "costos_descripcion": "oejakfpojpfjae", "procesos_optimizados": ["jefijlaef"]}	[{"nombre": "jfpoeajpñf", "unidad": "m", "valor_actual": "2", "valor_objetivo": "30"}, {"nombre": "jfoeia", "unidad": "h", "valor_actual": "0", "valor_objetivo": "30"}]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-16 12:40:19.349678	2026-02-20 00:57:23.379434	\N	\N	0	\N	\N	\N	\N	2026-03-01	2026-04-15	{}	\N	0	\N	\N	\N
10	SOL-202602-0010	transferido_ti	descartado_nt	alta	[Transferido de TKT-202602-0002] Evaluación de nuevo sistema	\N	9	5	{"email": "test@test.com", "nombre": "Test User"}	{}	[]	{"ticket_origen": "TKT-202602-0002", "descripcion_original": "[Transferido de SOL-2026-0004]\\n\\nSistema falla al iniciar\\n\\nMotivo de transferencia: Este fallo requiere soporte TI directo", "motivo_transferencia": "hoo"}	{}	{}	{}	[]	{}	\N	2026-02-16 12:45:30.666322	2026-02-20 00:57:51.080634	\N	\N	0	\N	7	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
11	SOL-202602-0011	transferido_ti	descartado_nt	media	[Transferido de TKT-202602-0003] Problema de conexión a red	\N	3	5	{"email": "ing.tecnologia1@inemec.com", "nombre": "Andrés Gustavo Pérez Sarmiento"}	{}	[]	{"ticket_origen": "TKT-202602-0003", "descripcion_original": "test it.              ", "motivo_transferencia": "Requiere evaluación técnica avanzada"}	{}	{}	{}	[]	{}	\N	2026-02-16 13:04:41.754079	2026-02-20 00:57:51.087219	\N	\N	0	\N	8	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
19	SOL-2026-0019	actualizacion	pendiente_evaluacion_nt	alta	Mejoras al sistema de facturacion	26	\N	\N	{"area": "Finanzas", "cargo": "Analista Financiero", "cedula": "55667788", "correo": "test2@inemec.com", "telefono": "3005556677", "es_doliente": false, "nombre_completo": "Diana Vargas Test", "operacion_contrato": "INEMEC Corporativo"}	{"area": "Finanzas", "cargo": "Director Financiero", "cedula": "11223399", "correo": "director.fin@inemec.com", "nombre_completo": "Ricardo Gomez Sponsor", "operacion_contrato": "INEMEC Corporativo"}	{"externas": {"sectores": ["Clientes", "DIAN"]}, "internas": {"areas": ["Finanzas", "Contabilidad", "Ventas"]}, "aplica_externas": true}	{"origen": "Cambios en regulacion tributaria colombiana.", "titulo": "Mejoras al sistema de facturacion", "impacto_nivel": "critica", "situacion_actual": "El sistema actual no soporta las nuevas regulaciones de la DIAN para 2026.", "impacto_descripcion": "Multas de hasta 500M COP si no cumplimos antes de julio 2026", "afectacion_operacion": "Riesgo de multas si no cumplimos con la nueva normativa.", "procesos_comprometidos": "Facturacion electronica, reportes a la DIAN, contabilidad"}	{"nivel": "inmediata", "fecha_limite": "2026-07-01T00:00:00.000Z", "justificacion_nt": "Fecha limite regulatoria es julio 2026, necesitamos tiempo para pruebas", "necesidad_principal": "Actualizar sistema para cumplir nueva normativa DIAN"}	{"funcionalidades_minimas": ["Nuevo formato XML DIAN", "Firma electronica actualizada", "Reportes de validacion"]}	{"descripcion": "Cumplimiento regulatorio y evitar multas", "mejora_concreta": "Cumplimiento del 100% con regulacion DIAN 2026", "reduccion_costos": true, "reduccion_costos_descripcion": "Evitar multas de hasta 500M COP"}	[{"nombre": "Cumplimiento normativo", "valor_actual": "70%", "valor_objetivo": "100%"}]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-20 03:28:56.497809	2026-02-20 03:28:56.497809	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
13	SOL-2026-0013	proyecto_nuevo_interno	en_estudio	media	Sistema de registro de disciplina operativa	17	\N	5	{"area": "administracion", "cargo": "Gerente de Cuentas y Proyectos", "cedula": "80212566", "correo": "gte.comercial@inemec.com", "telefono": "3176698712", "es_doliente": true, "nombre_completo": "Gabriel Fernando Cordoba", "operacion_contrato": "otro"}	{}	{"internas": {"areas": ["HSE", "Administración"], "personas": ["Jennifer Sanguino", "Samuel Ronderos", "Omar Quiñones"]}, "aplica_externas": false}	{"origen": "El origen del problema es que de acuerdo al programa de Disciplina Operativa de SierraCol Energy, ahora los procedimientos deben de ser directamente del ejuecutante y no de la operadora. Adicional tambien se esta implementando el programa de seguridad de procesos de INEMEC", "fecha_inicio": "2025-12-01T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "Para Disciplina Operativa , se necesita realizar el traslado de procedimientos desde SierraCol Energy a INEMEC, por ende, para tener eficiencia en el traslado de los 250 procedimientos, se requiere  ayuda de la IA", "impacto_descripcion": "El no cumplimineto de los procedimientos del cliente para la ejecucion de trabajos impacta en penalidades generadas al contrato CW2261100", "afectacion_operacion": "En la ejecucion y en el cumplimiento de procedimientos de SierraCol Energy", "procesos_comprometidos": "Seguridad de procesos (Disciplina Operativa),. HSE, Administracion"}	{"nivel": "mediano_plazo", "fecha_limite": "2026-04-17T05:00:00.000Z", "justificacion_nt": "Por el uso de IA para ser mas eficientes en el traslado de la informacion", "necesidad_principal": "Procesar los procedimientos actuales (SierraCol ENergy) y pasarlos a formato INEMEC con las condiciones/premisas que contiene dicho formato"}	{"tipo": "automatizacion", "casos_uso": "Caso 1: Dar continuidad de disciplina operativa\\nCaso 2: Cumplimiento contractual", "forma_entrega": "api", "tipo_descripcion": "Similar a un procedimiento previo realizado en GGS", "descripcion_ideal": "La documentación 250 procedimientos de SierraCol en formatos y con los puntos claves de Inemec", "tiene_restricciones": false, "funcionalidades_minimas": ["Cambio de formato de la documentación"]}	{"descripcion": "Cumplimiento contractual", "mejora_concreta": "Estandarización de formatos. A corto tiempo, traslado amplio de la información.", "reduccion_costos": true, "costos_descripcion": "Es un requerimiento contractual. El realizarlo con NT reduce los costos comparado por medios tradicionales."}	[{"nombre": "Numero de procedimientos en formato de inemec sobre total", "unidad": "%", "valor_actual": "0", "valor_objetivo": "100"}]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-17 18:24:30.348399	2026-02-20 00:57:23.397027	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
20	SOL-2026-0020	actualizacion	pendiente_evaluacion_nt	media	Nuevos reportes para sistema de inventarios	26	\N	\N	{"area": "Logistica", "cargo": "Jefe de Almacen", "cedula": "66778899", "correo": "test2@inemec.com", "telefono": "3006667788", "es_doliente": true, "nombre_completo": "Andres Moreno Test", "operacion_contrato": "Ecopetrol"}	{}	{"internas": {"areas": ["Logistica", "Compras"]}, "aplica_externas": false}	{"origen": "Necesidad de mejor analisis para optimizar compras.", "titulo": "Nuevos reportes para sistema de inventarios", "impacto_nivel": "media", "situacion_actual": "Los reportes actuales no muestran informacion de rotacion de inventario por categoria.", "impacto_descripcion": "Sobrecostos por inventario excesivo o faltantes", "afectacion_operacion": "Decisiones de compra suboptimas por falta de informacion detallada.", "procesos_comprometidos": "Analisis de inventario, planificacion de compras"}	{"nivel": "mediano_plazo", "justificacion_nt": "Mejora operativa que puede esperar pero es importante", "necesidad_principal": "Agregar reportes de rotacion y analisis ABC"}	{"funcionalidades_minimas": ["Reporte de rotacion", "Analisis ABC", "Dashboard de KPIs"]}	{"descripcion": "Mejor toma de decisiones en compras", "mejora_concreta": "Reduccion de inventario obsoleto en 20%"}	[{"nombre": "Inventario obsoleto", "valor_actual": "15%", "valor_objetivo": "5%"}]	{"confirmo_informacion": true}	\N	2026-02-20 03:29:59.111472	2026-02-20 03:29:59.111472	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
21	SOL-2026-0021	reporte_fallo	pendiente_evaluacion_nt	critica	Falla de conectividad en sede norte	26	\N	\N	{"area": "Operaciones", "cargo": "Coordinador de Sede", "cedula": "88888888", "correo": "test2@inemec.com", "es_doliente": true, "nombre_completo": "Coordinador Sede Norte", "operacion_contrato": "Ecopetrol"}	{}	{}	{"titulo": "Falla de conectividad en sede norte", "descripcion": "Desde las 8am no hay conexion a internet ni a la red corporativa en toda la sede norte. Afecta a 50 usuarios."}	{"urgencia": "critica", "justificacion": "50 personas sin poder trabajar, operaciones detenidas en sede norte"}	{}	{}	[]	{}	\N	2026-02-20 03:30:24.810815	2026-02-20 03:30:24.810815	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
23	SOL-2026-0023	cierre_servicio	pendiente_evaluacion_nt	baja	VERIFY: Cierre de servidor FILESRV01	30	\N	\N	{"area": "TI", "cargo": "Admin Infraestructura", "cedula": "56789012", "correo": "carlos@inemec.com", "es_doliente": true, "nombre_completo": "Carlos Martinez", "operacion_contrato": "INEMEC"}	{}	{}	{"titulo": "Cierre de servidor FILESRV01", "descripcion": "Servidor Windows 2012 sin usuarios activos. Datos migrados a SharePoint. Genera costos innecesarios."}	{}	{}	{}	[]	{"confirmacion": true}	\N	2026-02-20 03:45:56.874135	2026-02-20 03:45:56.874135	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
24	SOL-2026-0024	proyecto_nuevo_interno	pendiente_evaluacion_nt	media	VERIFY: Portal de autoservicio empleados	30	\N	\N	{"area": "Gestion Humana", "cargo": "Gerente GH", "cedula": "67890123", "correo": "diana@inemec.com", "es_doliente": true, "nombre_completo": "Diana Rojas", "operacion_contrato": "INEMEC"}	{}	{"internas": {"areas": ["GH", "Nomina", "TI"], "personas": ["Coordinadores", "Analistas"]}, "aplica_externas": false}	{"origen": "Carga administrativa excesiva", "titulo": "Portal autoservicio empleados", "impacto_nivel": "alta", "situacion_actual": "200+ consultas mensuales a RRHH", "impacto_descripcion": "Tiempo respuesta 3-5 dias", "afectacion_operacion": "Personal no puede enfocarse en tareas estrategicas", "procesos_comprometidos": "Certificados, vacaciones, nomina"}	{"nivel": "mediano_plazo", "justificacion_nt": "Implementar Q2 2026", "necesidad_principal": "Reducir carga operativa RRHH"}	{"funcionalidades_minimas": ["Login AD", "Consulta vacaciones", "Descarga certificados"]}	{"descripcion": "Autoservicio 24/7", "mejora_concreta": "De 200 a 40 consultas mensuales", "reduccion_costos": true}	[]	{"confirmo_informacion": true}	\N	2026-02-20 03:45:56.926771	2026-02-20 03:45:56.926771	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
25	SOL-2026-0025	actualizacion	pendiente_evaluacion_nt	alta	VERIFY: Modulo trazabilidad ERP	30	\N	\N	{"area": "Produccion", "cargo": "Jefe Produccion", "cedula": "78901234", "correo": "fernando@inemec.com", "es_doliente": false, "nombre_completo": "Fernando Castro", "operacion_contrato": "INEMEC Planta 1"}	{"area": "Operaciones", "cargo": "Directora Operaciones", "cedula": "23456789", "correo": "margarita@inemec.com", "nombre_completo": "Margarita Lopez", "operacion_contrato": "INEMEC"}	{"externas": {"empresas": ["Cliente principal"], "personas": ["Auditores externos"], "sectores": ["Industrial"]}, "internas": {"areas": ["Produccion", "Calidad"], "personas": ["Supervisores", "Inspectores"]}, "aplica_externas": true}	{"origen": "Requerimiento clientes ISO", "titulo": "Modulo trazabilidad ERP", "impacto_nivel": "critica", "situacion_actual": "Trazabilidad en Excel, toma 2-3 dias", "impacto_descripcion": "Riesgo perder clientes", "afectacion_operacion": "Auditorias fallidas", "procesos_comprometidos": "Rastreo lotes, reclamos, auditorias"}	{"nivel": "corto_plazo", "justificacion_nt": "Auditoria abril 2026", "necesidad_principal": "Cumplir requisitos trazabilidad ISO"}	{"funcionalidades_minimas": ["Registro lotes", "Trazabilidad produccion", "Reporte recall"]}	{"descripcion": "Cumplimiento ISO 22000", "mejora_concreta": "Rastreo de 2-3 dias a 5 minutos", "reduccion_costos": false}	[]	{"confirmo_informacion": true}	\N	2026-02-20 03:46:32.494339	2026-02-20 03:46:32.494339	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
26	SOL-2026-0026	reporte_fallo	pendiente_evaluacion_nt	alta	FILETEST: Error con archivos adjuntos	30	\N	\N	{"area": "Calidad", "cargo": "QA Engineer", "cedula": "99999999", "correo": "tester@inemec.com", "es_doliente": true, "nombre_completo": "Tester Archivos", "operacion_contrato": "INEMEC"}	{}	{}	{"titulo": "Error con archivos adjuntos", "descripcion": "Prueba de carga de archivos al sistema. Adjunto evidencias del error."}	{"urgencia": "alta", "justificacion": "Prueba de funcionalidad de archivos"}	{}	{}	[]	{}	\N	2026-02-20 04:10:02.960815	2026-02-20 04:10:02.960815	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
27	SOL-2026-0027	proyecto_nuevo_interno	pendiente_evaluacion_nt	alta	giuhonlm	32	\N	\N	{"area": "gerencia_general", "cargo": "bnjlkm", "cedula": "567865", "correo": "ugyhinom@inemec.com", "es_doliente": true, "nombre_completo": "ubinlmk", "operacion_contrato": "oficina_principal"}	{}	{"internas": {}}	{"origen": "iuhnlkm", "titulo": "giuhonlm", "evidencia": [{"uid": "rc-upload-1771561546450-4", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771561546450-4"}}], "fecha_inicio": "2026-02-19T05:00:00.000Z", "impacto_nivel": "baja", "situacion_actual": "iuhnolmkñ", "impacto_descripcion": "ihuojnmñ", "afectacion_operacion": "giuhonlmñ", "procesos_comprometidos": "iunlkmñ"}	{"nivel": "corto_plazo", "fecha_limite": "2026-02-21T05:00:00.000Z", "justificacion_nt": "giuhnolmñ", "necesidad_principal": "giuhoinm"}	{"funcionalidades_minimas": ["iuhnomñ"]}	{"descripcion": "bnlkm ", "analisis_costos": {"costos_actuales": [{"valor": 10000, "cantidad": 1, "descripcion": "6789"}], "costos_esperados": [{"valor": 5000, "cantidad": 1, "descripcion": "19900"}]}, "mejora_concreta": "gyuihojnmp", "reduccion_costos": true, "beneficio_monetario": {"items": [{"valor": 10000, "cantidad": 1, "descripcion": "fjkhuionm"}], "justificacion": "bnlkm", "espera_beneficio": true}}	[]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-20 04:34:27.047697	2026-02-20 04:34:27.047697	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
28	SOL-2026-0028	actualizacion	pendiente_evaluacion_nt	critica	uhinl	36	\N	\N	{"area": "operaciones", "cargo": "nklm", "cedula": "1005257395", "correo": "dodke@inemec.com", "es_doliente": true, "nombre_completo": "inml", "operacion_contrato": "oficina_principal"}	{}	{"internas": {}}	{"origen": "inlm", "titulo": "uhinl", "impacto_nivel": "baja", "situacion_actual": "ihunlm", "impacto_descripcion": "ubyinlm", "afectacion_operacion": "iubhnlm", "procesos_comprometidos": "inlkm"}	{"nivel": "inmediata", "justificacion_nt": "guyibhunom", "necesidad_principal": "uybinml"}	{"funcionalidades_minimas": ["uybinom"]}	{"descripcion": "ibunolm", "analisis_costos": {"costos_actuales": [{"valor": 5678000, "cantidad": 1, "descripcion": "2849"}], "costos_esperados": [{"valor": 569000, "cantidad": 1, "descripcion": "ejk"}]}, "mejora_concreta": "binjlkm", "reduccion_costos": true, "beneficio_monetario": {"items": [{"valor": 10000000, "cantidad": 1, "descripcion": "hifl"}], "justificacion": "fhjkmeñ", "espera_beneficio": true}}	[]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-20 04:45:04.756955	2026-02-20 04:45:04.756955	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
30	SOL-2026-0030	proyecto_nuevo_interno	pendiente_evaluacion_nt	baja	yughinom	39	\N	\N	{"area": "gerencia_general", "cargo": "uybinom", "cedula": "24879810", "correo": "ihuojkp@inemec.com", "telefono": "5467829", "es_doliente": false, "nombre_completo": "ubinom", "operacion_contrato": "oficina_principal"}	{"area": "gerencia_general", "cargo": "uihom", "cedula": "7890", "correo": "hiuoj@ineufpf.com", "nombre_completo": "ugyihoni", "operacion_contrato": "planta_barranca"}	{"internas": {}}	{"origen": "ugyihnomp,ubinom", "titulo": "yughinom", "impacto_nivel": "media", "situacion_actual": "ubinom", "impacto_descripcion": "oimnubyvt", "afectacion_operacion": "ubiunomñ,", "procesos_comprometidos": "vuybinom"}	{"nivel": "largo_plazo", "justificacion_nt": "uihojpk", "necesidad_principal": "mkinubyvt"}	{"funcionalidades_minimas": ["lkmnjbhuvy"]}	{"descripcion": "lkmnjibuyvtc", "mejora_concreta": "mlknibuyvt", "beneficio_monetario": {}}	[]	{"confirmo_informacion": true}	\N	2026-02-20 04:49:55.537638	2026-02-20 04:49:55.537638	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
31	SOL-202602-0031	transferido_ti	pendiente_evaluacion_nt	critica	[Transferido de TKT-2026-0023] tfyguhinomp	37	9	\N	{"area": "gerencia_general", "cargo": "ibunom", "cedula": "1005257395", "correo": "hjoik@inemec.com", "criticidad": {"urgencia": "critica", "justificacion": "rctyvubinom"}, "es_doliente": true, "nombre_completo": "inom", "operacion_contrato": "oficina_principal"}	{}	[]	{"ticket_origen": "TKT-2026-0023", "descripcion_original": "gyihuojmtcryvubinomhj", "motivo_transferencia": "knllklmlkk"}	{}	{}	{}	[]	{}	\N	2026-02-20 04:53:25.251267	2026-02-20 04:53:25.251267	\N	\N	0	\N	28	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
29	SOL-2026-0029	reporte_fallo	transferido_ti	critica	uyhio	38	\N	\N	{"area": "gerencia_general", "cargo": "binlm", "cedula": "1005257395", "correo": "buinom@inemec.com", "es_doliente": true, "nombre_completo": "uybinom", "operacion_contrato": "oficina_principal"}	{}	{}	{"titulo": "uyhio", "descripcion": "ubyinombinomkklkibhoio"}	{"urgencia": "critica", "justificacion": "fgihuoijpmo"}	{}	{}	[]	{}	\N	2026-02-20 04:48:05.969474	2026-02-20 07:24:08.97713	\N	\N	0	30	\N	Transferido a TI. Nuevo ticket: TKT-202602-0025. Motivo: transfer	2026-02-20 07:24:08.97713	\N	\N	{}	\N	0	\N	\N	\N
36	SOL-202602-0036	transferido_ti	pendiente_evaluacion_nt	alta	VERIFY: Error de impresora en recepcion	30	9	\N	{"area": "Atencion al Cliente", "cargo": "Recepcionista Senior", "cedula": "32145678", "correo": "maria.gonzalez@inemec.com", "telefono": "3109876543", "criticidad": {"urgencia": "alta", "justificacion": "Recepcion no puede imprimir documentos para visitantes"}, "es_doliente": true, "nombre_completo": "Maria Elena Gonzalez", "operacion_contrato": "INEMEC Bogota"}	{}	[]	{"ticket_origen": "TKT-2026-0022", "descripcion_original": "La impresora HP LaserJet del area de recepcion muestra error E4. Ya se intento reiniciar sin exito.", "motivo_transferencia": "transfer"}	{}	{}	{}	[]	{}	\N	2026-02-20 06:53:26.769669	2026-02-20 06:53:26.769669	\N	\N	0	\N	27	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
34	SOL-202602-0034	transferido_ti	completado	critica	PRUEBA COMPLETA: Falla critica en sistema ERP	30	9	5	{"area": "Contabilidad", "cargo": "Coordinadora Contable", "cedula": "52123456", "correo": "comprehensive.test@inemec.com", "telefono": "3001234567", "criticidad": {"urgencia": "critica", "justificacion": "El cierre contable del mes vence hoy a las 5PM. Sin este sistema no podemos cumplir con obligaciones tributarias. Riesgo de multas DIAN."}, "es_doliente": true, "nombre_completo": "Carolina Mendez Vargas", "operacion_contrato": "INEMEC Corporativo"}	{}	[]	{"ticket_origen": "TKT-2026-0021", "descripcion_original": "El modulo de facturacion electronica presenta errores al generar documentos. Mensaje: Error 500 - Connection timeout. Afecta a todo el departamento contable (15 personas). El problema inicio hoy a las 8:00 AM.", "motivo_transferencia": "test1"}	{}	{}	{}	[]	{}	\N	2026-02-20 06:28:28.380805	2026-02-20 08:58:37.740382	\N	\N	0	\N	26	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
12	SOL-2026-0012	proyecto_nuevo_interno	en_estudio	critica	Desarrollo de app móvil para técnicos en campo	1	\N	5	{"area": "gerencia_general", "cargo": "aaa", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "aaaa", "operacion_contrato": "oficina_principal"}	{}	{"internas": {"areas": ["a", "b"], "personas": ["a"]}, "aplica_externas": false}	{"origen": "aaa", "fecha_inicio": "2026-02-01T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "aa", "impacto_descripcion": "aaa", "afectacion_operacion": "aaa", "procesos_comprometidos": "aaa"}	{"nivel": "inmediata", "fecha_limite": "2026-05-07T05:00:00.000Z", "justificacion_nt": "aaa", "necesidad_principal": "aaa"}	{"tipo": "integracion", "descripcion_ideal": "aaa", "funcionalidades_minimas": ["a"]}	{"descripcion": "aaa", "mejora_concreta": "aaa", "reduccion_costos": true, "costos_descripcion": "aa", "procesos_optimizados": ["aa"]}	[{"nombre": "tiempo", "unidad": "a", "valor_actual": "a", "valor_objetivo": "a"}]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-17 17:55:07.555796	2026-02-20 08:38:27.593786	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
35	SOL-202602-0035	transferido_ti	completado	critica	URGENTE: Servidor de produccion caido	26	9	5	{"area": "Tecnologia", "cargo": "Administrador de Sistemas", "cedula": "99999999", "correo": "test2@inemec.com", "criticidad": {"urgencia": "critica", "justificacion": "Toda la operacion esta detenida. Perdidas estimadas de 10M COP por hora."}, "es_doliente": true, "nombre_completo": "Admin Sistemas Urgente", "operacion_contrato": "INEMEC Corporativo"}	{}	[]	{"ticket_origen": "TKT-2026-0020", "descripcion_original": "El servidor principal de produccion no responde. Todos los sistemas estan fuera de linea. Impacto total en la operacion.", "motivo_transferencia": "test 2"}	{}	{}	{}	[]	{}	\N	2026-02-20 06:28:51.910733	2026-02-20 08:58:27.701008	\N	\N	0	\N	25	\N	\N	\N	\N	{"proyecto_id": "otro", "proyecto_nombre_otro": "jljflke"}	\N	0	\N	\N	\N
32	SOL-2026-0032	actualizacion	pendiente_aprobacion_gerencia	critica	jkñ,iojpko	\N	5	5	{"area": "ti", "cargo": "jdoef", "cedula": "8390", "correo": "mfijo@c.com", "es_doliente": true, "nombre_completo": "djpf", "operacion_contrato": "planta_barranca"}	{}	{"internas": {}}	{"origen": "inomp,", "titulo": "jkñ,iojpko", "impacto_nivel": "critica", "situacion_actual": "iuojmp,´", "impacto_descripcion": "buinomp,", "afectacion_operacion": "bnjmklñ,", "procesos_comprometidos": "buinom,"}	{"nivel": "inmediata", "justificacion_nt": "ftyguhijokp", "necesidad_principal": "ubinomp,"}	{"referencias": [{"uid": "rc-upload-1771564003266-4", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771564003266-4"}}], "funcionalidades_minimas": ["ubinom"]}	{"descripcion": "vyubinoml", "mejora_concreta": "vubiunom", "beneficio_monetario": {}}	[]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-20 05:08:37.93076	2026-02-20 11:47:06.997396	\N	\N	0	\N	\N	\N	\N	\N	\N	{}	\N	0	\N	\N	\N
33	SOL-2026-0033	proyecto_nuevo_interno	agendado	critica	jfpokeajf	\N	5	5	{"area": "gerencia_general", "cargo": "efmlf", "cedula": "380", "correo": "fmepfk@i.co", "es_doliente": true, "nombre_completo": "fjpkeof", "operacion_contrato": "oficina_principal"}	{}	{"internas": {}}	{"origen": "fempao,f", "titulo": "jfpokeajf", "evidencia": [{"uid": "rc-upload-1771564326330-4", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771564326330-4"}}], "impacto_nivel": "media", "situacion_actual": "jfaepkof", "impacto_descripcion": "fejoikpaf", "afectacion_operacion": "jfokpe", "procesos_comprometidos": "joefpkaf"}	{"nivel": "inmediata", "justificacion_nt": "eofjipka", "necesidad_principal": "ehfoijpkae"}	{"tipo": "aplicacion_movil", "referencias": [{"uid": "rc-upload-1771564326330-6", "name": "Anticipo repuestos Saturn 4.pdf", "size": 179152, "type": "application/pdf", "status": "done", "originFileObj": {"uid": "rc-upload-1771564326330-6"}}], "funcionalidades_minimas": ["efnlm"]}	{"descripcion": "uybinomiuhojp", "mejora_concreta": "hiuojp", "beneficio_monetario": {}}	[]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-20 05:13:42.370118	2026-02-20 11:44:36.385487	\N	\N	0	\N	\N	\N	\N	2026-02-20	2026-03-30	{}	\N	0	\N	\N	\N
6	SOL-2026-0006	proyecto_nuevo_interno	agendado	critica	Mejora del portal de clientes	\N	5	5	{"area": "gerencia_general", "cargo": "NT", "cedula": "1005257395", "correo": "andreskks998@gmail.com", "telefono": "3123805368", "es_doliente": true, "nombre_completo": "Andrés Pérez", "operacion_contrato": "oficina_principal"}	{}	{"internas": {"areas": ["it"], "personas": ["jesus cotes"]}, "aplica_externas": false}	{"origen": "Origen test NT", "evidencia": [{"uid": "rc-upload-1771244541616-11", "name": "CV_Andres_Perez_Espanol.pdf", "size": 112468, "status": "done", "originFileObj": {"uid": "rc-upload-1771244541616-11"}}], "fecha_inicio": "2026-02-28T05:00:00.000Z", "impacto_nivel": "alta", "situacion_actual": "problema test NT", "impacto_descripcion": "nod", "afectacion_operacion": "Efecto TEst nt", "procesos_comprometidos": "TODOS"}	{"nivel": "inmediata", "fecha_limite": "2026-02-19T05:00:00.000Z", "justificacion_nt": "nadifh", "necesidad_principal": "na"}	{"tipo": "automatizacion", "casos_uso": "hflakhdjenejaknflanksdkl", "referencias": [{"uid": "rc-upload-1771244541616-7", "name": "CV_Andres_Perez_Espanol.pdf", "size": 112468, "status": "done", "originFileObj": {"uid": "rc-upload-1771244541616-7"}}], "forma_entrega": "web", "tipo_descripcion": "djlkjd", "usuarios_finales": ["Jesus cotes"], "descripcion_ideal": "djlksahflshlkanjkenalknd", "tiene_restricciones": false, "funcionalidades_minimas": ["Aplicación"], "funcionalidades_deseables": ["jdojr"]}	{"descripcion": "hfiosajd", "mejora_concreta": "knsflkad", "reduccion_costos": false, "procesos_optimizados": ["proceso"]}	[{"nombre": "kpi", "unidad": "20", "valor_actual": "0", "valor_objetivo": "30"}]	{"acepto_seguimiento": true, "confirmo_informacion": true}	\N	2026-02-16 12:35:16.937094	2026-02-20 11:45:32.067664	\N	\N	0	\N	\N	\N	\N	2026-02-23	2026-04-29	{}	\N	0	\N	\N	\N
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.tickets (id, codigo, titulo, descripcion, categoria, estado, prioridad, solicitante_id, usuario_creador_id, asignado_id, datos_solicitante, resolucion, fecha_resolucion, creado_en, actualizado_en, transferido_a_solicitud_id) FROM stdin;
7	TKT-202602-0002	[Transferido de SOL-2026-0004] Test: Fallo en sistema de prueba	[Transferido de SOL-2026-0004]\n\nSistema falla al iniciar\n\nMotivo de transferencia: Este fallo requiere soporte TI directo	soporte_general	transferido_nt	alta	\N	5	\N	{"email": "test@test.com", "nombre": "Test User"}	Transferido a NT. Nueva solicitud: SOL-202602-0010. Motivo: hoo	2026-02-16 12:45:30.666322	2026-02-16 02:53:31.003772	2026-02-16 12:45:30.666322	10
10	TKT-TEST-001	Test A - Problema con impresora no funciona	La impresora del piso 3 no enciende desde esta mañana. Se intentó reiniciar pero sigue sin responder.	hardware	abierto	critica	\N	\N	\N	{"email": "juan.perez@test.com", "nombre": "Juan Pérez", "departamento": "Contabilidad"}	\N	\N	2026-02-14 16:41:47.515275	2026-02-16 16:41:47.515275	\N
11	TKT-TEST-002	Test B - Acceso denegado a sistema ERP	No puedo acceder al módulo de inventarios del ERP. Me aparece error de permisos.	acceso	abierto	alta	\N	\N	\N	{"email": "maria.garcia@test.com", "nombre": "María García", "departamento": "Almacén"}	\N	\N	2026-02-15 16:41:47.515275	2026-02-16 16:41:47.515275	\N
12	TKT-TEST-003	Test C - Instalación de software contable	Se requiere instalar actualización del software contable en 5 equipos del área financiera.	software	en_proceso	alta	\N	\N	\N	{"email": "carlos.lopez@test.com", "nombre": "Carlos López", "departamento": "Finanzas"}	\N	\N	2026-02-13 16:41:47.515275	2026-02-16 16:41:47.515275	\N
13	TKT-TEST-004	Test D - Red lenta en oficina principal	La conexión a internet está muy lenta en toda la oficina principal desde ayer.	red	en_proceso	critica	\N	\N	\N	{"email": "ana.martinez@test.com", "nombre": "Ana Martínez", "departamento": "Operaciones"}	\N	\N	2026-02-12 16:41:47.515275	2026-02-16 16:41:47.515275	\N
1	TKT-202602-0001	Configuración de equipo nuevo para usuario	test descripción 1234	soporte_general	transferido_nt	critica	\N	5	\N	{"email": "ing.tecnologia1@inemec.com", "nombre": "Andrés Gustavo Pérez Sarmiento"}	Transferido a NT. Nueva solicitud: SOL-2026-0005. Motivo: Requiere desarrollo	2026-02-16 02:53:53.099338	2026-02-15 14:57:15.08367	2026-02-20 00:57:23.320726	5
8	TKT-202602-0003	Problema de conexión a internet intermitente	test it.              	soporte_general	en_proceso	media	\N	5	9	{"email": "ing.tecnologia1@inemec.com", "nombre": "Andrés Gustavo Pérez Sarmiento"}	\N	\N	2026-02-16 12:22:15.243394	2026-02-20 00:57:23.340061	11
9	TKT-202602-0004	Sin acceso a internet en oficina norte	Se me calló el internet\n	soporte_general	en_proceso	critica	\N	9	9	{"email": "pro.automatizacion@inemec.com", "nombre": "Andrés Muñoz"}	\N	\N	2026-02-16 16:26:27.189589	2026-02-20 00:57:23.343697	\N
14	TKT-TEST-005	Test E - Configuración de nuevo equipo	Se necesita configurar laptop nueva para empleado que ingresa la próxima semana.	hardware	resuelto	baja	\N	\N	\N	{"email": "pedro.sanchez@test.com", "nombre": "Pedro Sánchez", "departamento": "RRHH"}	\N	\N	2026-02-09 16:41:47.515275	2026-02-16 16:41:47.515275	\N
15	TKT-TEST-006	Test F - Problema con correo electrónico	El correo no sincroniza en el celular corporativo.	software	solucionado	media	\N	\N	\N	{"email": "laura.torres@test.com", "nombre": "Laura Torres", "departamento": "Ventas"}	\N	\N	2026-02-11 16:41:47.515275	2026-02-16 16:41:47.515275	\N
16	TKT-TEST-007	Test G - Solicitud de VPN para teletrabajo	Requiero acceso VPN para trabajar desde casa los viernes.	acceso	cerrado	baja	\N	\N	\N	{"email": "roberto.diaz@test.com", "nombre": "Roberto Díaz", "departamento": "Marketing"}	\N	\N	2026-02-06 16:41:47.515275	2026-02-16 16:41:47.515275	\N
17	TKT-TEST-008	Test H - Evaluación de nuevo sistema de gestión	Requiere análisis técnico profundo para evaluar integración con sistemas actuales.	otro	escalado_nt	alta	\N	\N	\N	{"email": "diana.ruiz@test.com", "nombre": "Diana Ruiz", "departamento": "Gerencia"}	\N	\N	2026-02-10 16:41:47.515275	2026-02-16 16:41:47.515275	\N
18	TKT-TEST-009	Test I - Migración de datos a nuevo servidor	El ticket requiere desarrollo especializado y fue transferido al equipo de NT.	soporte_general	transferido_nt	media	\N	\N	\N	{"email": "felipe.mora@test.com", "nombre": "Felipe Mora", "departamento": "Logística"}	\N	\N	2026-02-08 16:41:47.515275	2026-02-16 16:41:47.515275	\N
19	TKT-TEST-010	Test J - Reparación de monitor dañado	El monitor tiene daño físico irreparable. Se recomendó reemplazo pero fue rechazado por presupuesto.	hardware	no_realizado	baja	\N	\N	\N	{"email": "sofia.herrera@test.com", "nombre": "Sofía Herrera", "departamento": "Diseño"}	\N	\N	2026-02-04 16:41:47.515275	2026-02-16 16:41:47.515275	\N
20	TKT-2026-0015	Verificación completa de formulario de soporte	Este es un ticket de prueba creado para verificar que todos los campos del formulario se guardan correctamente. Incluye nombre, cargo, área, operación, teléfono, cédula, y criticidad.	software	abierto	media	\N	\N	\N	{"area": "Operaciones - Mantenimiento", "cargo": "Ingeniero de Proyectos", "cedula": "1234567890", "correo": "carlos.martinez@inemec.com", "telefono": "3101234567", "criticidad": {"urgencia": "alta", "justificacion": "El sistema de reportes no permite generar informes mensuales, lo cual afecta la entrega de documentación al cliente."}, "es_doliente": true, "nombre_completo": "Carlos Eduardo Martínez López", "operacion_contrato": "Contrato Ecopetrol"}	\N	\N	2026-02-16 22:22:45.908374	2026-02-20 00:57:23.347228	\N
21	TKT-2026-0016	Instalación de software para área contable	dajsfpkfpokpoefjkmfsafmñ	software	solucionado	alta	1	\N	9	{"area": "gerencia_general", "cargo": "jflasjf", "cedula": "1005257395", "correo": "jfoasfj@gmail.com", "telefono": "3123805368", "criticidad": {"urgencia": "alta", "justificacion": "jdfjalñfjljefpjefpoojf"}, "es_doliente": true, "nombre_completo": "jcpjdsa", "operacion_contrato": "oficina_principal"}	\N	2026-02-19 20:25:22.153971	2026-02-19 20:18:40.791318	2026-02-20 00:57:23.353776	\N
22	TKT-2026-0017	jñfñsakñkñ	kfñakfñkeñakñfkñakñcñmñca	red	abierto	alta	1	\N	\N	{"area": "gerencia_general", "cargo": "fjñsakfñ", "cedula": "1005257395", "correo": "jfpoeap@inemec.com", "telefono": "3123805368", "criticidad": {"urgencia": "alta", "justificacion": "jfejflajñfñkfñe"}, "es_doliente": true, "nombre_completo": "jfñsfñkñaf", "operacion_contrato": "oficina_principal"}	\N	\N	2026-02-20 02:18:17.850659	2026-02-20 02:18:17.850659	\N
23	TKT-2026-0018	jpoñkpokpk	erdtcfyvubinmñ,lugyhijo	hardware	abierto	baja	23	\N	\N	{"area": "gerencia_general", "cargo": "hh", "cedula": "10005256839", "correo": "giuhio@inemec.com", "criticidad": {"urgencia": "baja", "justificacion": "sdfghjkdrtfyguhij"}, "es_doliente": true, "nombre_completo": "hhlijo", "operacion_contrato": "oficina_principal"}	\N	\N	2026-02-20 03:22:15.470823	2026-02-20 03:22:15.470823	\N
24	TKT-2026-0019	Test IT Ticket - Impresora no funciona	La impresora del tercer piso no enciende desde ayer. Ya probamos enchufarla en otro tomacorriente.	hardware	abierto	media	24	\N	\N	{"area": "Tecnologia", "cargo": "Analista de Sistemas", "cedula": "12345678", "correo": "test@inemec.com", "telefono": "3001234567", "criticidad": {"urgencia": "media", "justificacion": "Afecta productividad del equipo pero tenemos alternativas temporales"}, "es_doliente": true, "nombre_completo": "Juan Perez Test", "operacion_contrato": "INEMEC Corporativo"}	\N	\N	2026-02-20 03:24:51.287215	2026-02-20 03:24:51.287215	\N
29	TKT-2026-0024	guyiuhonpm	ugyibnom ñibnomp,{inm	acceso	en_proceso	critica	39	\N	9	{"area": "gerencia_general", "cargo": "binomp", "cedula": "67489", "correo": "ihuojpk@yahoo.com", "criticidad": {"urgencia": "critica", "justificacion": "d6ft7gy8hiujo"}, "es_doliente": true, "nombre_completo": "ihuojpk", "operacion_contrato": "oficina_principal"}	\N	\N	2026-02-20 04:50:45.933444	2026-02-20 04:52:22.106656	\N
28	TKT-2026-0023	tfyguhinomp	gyihuojmtcryvubinomhj	hardware	transferido_nt	critica	37	\N	\N	{"area": "gerencia_general", "cargo": "ibunom", "cedula": "1005257395", "correo": "hjoik@inemec.com", "criticidad": {"urgencia": "critica", "justificacion": "rctyvubinom"}, "es_doliente": true, "nombre_completo": "inom", "operacion_contrato": "oficina_principal"}	Transferido a NT. Nueva solicitud: SOL-202602-0031. Motivo: knllklmlkk	2026-02-20 04:53:25.251267	2026-02-20 04:45:58.711774	2026-02-20 04:53:25.251267	31
25	TKT-2026-0020	URGENTE: Servidor de produccion caido	El servidor principal de produccion no responde. Todos los sistemas estan fuera de linea. Impacto total en la operacion.	software	transferido_nt	critica	26	\N	\N	{"area": "Tecnologia", "cargo": "Administrador de Sistemas", "cedula": "99999999", "correo": "test2@inemec.com", "criticidad": {"urgencia": "critica", "justificacion": "Toda la operacion esta detenida. Perdidas estimadas de 10M COP por hora."}, "es_doliente": true, "nombre_completo": "Admin Sistemas Urgente", "operacion_contrato": "INEMEC Corporativo"}	Transferido a NT. Nueva solicitud: SOL-202602-0035. Motivo: test 2	2026-02-20 06:28:51.910733	2026-02-20 03:30:24.750832	2026-02-20 06:28:51.910733	35
27	TKT-2026-0022	VERIFY: Error de impresora en recepcion	La impresora HP LaserJet del area de recepcion muestra error E4. Ya se intento reiniciar sin exito.	hardware	transferido_nt	alta	30	\N	\N	{"area": "Atencion al Cliente", "cargo": "Recepcionista Senior", "cedula": "32145678", "correo": "maria.gonzalez@inemec.com", "telefono": "3109876543", "criticidad": {"urgencia": "alta", "justificacion": "Recepcion no puede imprimir documentos para visitantes"}, "es_doliente": true, "nombre_completo": "Maria Elena Gonzalez", "operacion_contrato": "INEMEC Bogota"}	Transferido a NT. Nueva solicitud: SOL-202602-0036. Motivo: transfer	2026-02-20 06:53:26.769669	2026-02-20 03:43:45.46484	2026-02-20 06:53:26.769669	36
26	TKT-2026-0021	PRUEBA COMPLETA: Falla critica en sistema ERP	El modulo de facturacion electronica presenta errores al generar documentos. Mensaje: Error 500 - Connection timeout. Afecta a todo el departamento contable (15 personas). El problema inicio hoy a las 8:00 AM.	software	transferido_nt	critica	30	\N	\N	{"area": "Contabilidad", "cargo": "Coordinadora Contable", "cedula": "52123456", "correo": "comprehensive.test@inemec.com", "telefono": "3001234567", "criticidad": {"urgencia": "critica", "justificacion": "El cierre contable del mes vence hoy a las 5PM. Sin este sistema no podemos cumplir con obligaciones tributarias. Riesgo de multas DIAN."}, "es_doliente": true, "nombre_completo": "Carolina Mendez Vargas", "operacion_contrato": "INEMEC Corporativo"}	Transferido a NT. Nueva solicitud: SOL-202602-0034. Motivo: test1	2026-02-20 06:28:28.380805	2026-02-20 03:36:03.235906	2026-02-20 06:28:28.380805	34
30	TKT-202602-0025	uyhio	[Transferido de SOL-2026-0029]\n\nubyinombinomkklkibhoio\n\nMotivo de transferencia: transfer	hardware	abierto	critica	38	5	\N	{"area": "gerencia_general", "cargo": "binlm", "cedula": "1005257395", "correo": "buinom@inemec.com", "es_doliente": true, "nombre_completo": "uybinom", "operacion_contrato": "oficina_principal"}	\N	\N	2026-02-20 07:24:08.97713	2026-02-20 07:24:37.382753	\N
\.


--
-- Data for Name: transferencias; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.transferencias (id, tipo, origen_tipo, origen_id, origen_codigo, destino_tipo, destino_id, destino_codigo, motivo, usuario_id, creado_en) FROM stdin;
2	solicitud_a_ticket	solicitud	4	SOL-2026-0004	ticket	7	TKT-202602-0002	Este fallo requiere soporte TI directo	5	2026-02-16 02:53:31.003772
3	ticket_a_solicitud	ticket	1	TKT-202602-0001	solicitud	5	SOL-2026-0005	Requiere desarrollo	5	2026-02-16 02:53:53.099338
4	ticket_a_solicitud	ticket	7	TKT-202602-0002	solicitud	10	SOL-202602-0010	hoo	9	2026-02-16 12:45:30.666322
5	ticket_a_solicitud	ticket	8	TKT-202602-0003	solicitud	11	SOL-202602-0011	Requiere evaluación técnica avanzada	3	2026-02-16 13:04:41.754079
6	ticket_a_solicitud	ticket	28	TKT-2026-0023	solicitud	31	SOL-202602-0031	knllklmlkk	9	2026-02-20 04:53:25.251267
7	ticket_a_solicitud	ticket	26	TKT-2026-0021	solicitud	34	SOL-202602-0034	test1	9	2026-02-20 06:28:28.380805
8	ticket_a_solicitud	ticket	25	TKT-2026-0020	solicitud	35	SOL-202602-0035	test 2	9	2026-02-20 06:28:51.910733
9	ticket_a_solicitud	ticket	27	TKT-2026-0022	solicitud	36	SOL-202602-0036	transfer	9	2026-02-20 06:53:26.769669
10	solicitud_a_ticket	solicitud	29	SOL-2026-0029	ticket	30	TKT-202602-0025	transfer	5	2026-02-20 07:24:08.97713
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: soldev_user
--

COPY public.usuarios (id, email, nombre, password_hash, rol, activo, creado_en, actualizado_en, ultimo_acceso) FROM stdin;
6	dorain.celis@inemec.com	Dorain Celis	$2a$10$0PP7qnhdcuwhM7hzGE5TxOA7ci1iMfmRqHe2ixb/W3YOIVt6QMyUi	gerencia	t	2026-02-12 12:52:10.864214	2026-02-20 11:51:31.275441	2026-02-20 11:51:31.275441
4	gerencia@inemec.com	Usuario Gerencia	$2a$10$1i13BaDRqwcyJ/Xk4JM5RuAKNbDoDflGo2yUvObKVFWa0gXWefBMO	gerencia	f	2026-02-11 20:12:49.726168	2026-02-19 21:16:28.796181	2026-02-16 14:28:43.309171
3	ti@inemec.com	Usuario TI	$2a$10$1i13BaDRqwcyJ/Xk4JM5RuAKNbDoDflGo2yUvObKVFWa0gXWefBMO	ti	f	2026-02-11 20:12:49.726168	2026-02-19 21:16:30.230361	2026-02-16 13:49:45.790491
9	pro.automatizacion@inemec.com	Andrés Muñoz	$2a$12$gSi.DtKUkMKwEZc53tqCyO4natGqYsK1F.alKu/3q87vJhoQnEb4m	ti	t	2026-02-12 12:55:13.367268	2026-02-20 07:24:25.152409	2026-02-20 07:24:25.152409
1	admin@inemec.com	Administrador NT	$2a$12$FPP0ebQzSV8BTuTklnjVJOgNnEQmcp1EY9KGMOKbOOWTm/hY3U5Uy	nuevas_tecnologias	f	2026-02-11 20:12:49.719664	2026-02-12 12:50:46.047721	2026-02-12 06:08:05.17412
2	nt@inemec.com	Usuario NT	$2a$12$FPP0ebQzSV8BTuTklnjVJOgNnEQmcp1EY9KGMOKbOOWTm/hY3U5Uy	nuevas_tecnologias	f	2026-02-11 20:12:49.726168	2026-02-12 12:57:23.860816	2026-02-12 12:50:32.783507
8	william.sarmiento@inemec.com	William Alfredo Sarmiento Salas	$2a$10$0PP7qnhdcuwhM7hzGE5TxOA7ci1iMfmRqHe2ixb/W3YOIVt6QMyUi	gerencia	t	2026-02-12 12:54:05.137296	2026-02-20 03:35:14.160156	\N
10	gte.cuentasyproyectos@inemec.com	Manuel Martinez	$2a$10$0PP7qnhdcuwhM7hzGE5TxOA7ci1iMfmRqHe2ixb/W3YOIVt6QMyUi	nuevas_tecnologias	t	2026-02-12 12:56:44.588168	2026-02-20 03:35:14.160156	\N
7	ing.tecnologia2@inemec.com	Jesus David Cotes Castilla	$2a$10$0PP7qnhdcuwhM7hzGE5TxOA7ci1iMfmRqHe2ixb/W3YOIVt6QMyUi	nuevas_tecnologias	t	2026-02-12 12:52:55.671723	2026-02-20 10:38:24.240376	2026-02-20 10:38:24.240376
5	ing.tecnologia1@inemec.com	Andrés Gustavo Pérez Sarmiento	$2a$12$/lAoCHW/bDUNLFfPUHIinu80erjpI/G/KdNs9dfpd.uTULC4Hc3jq	nuevas_tecnologias	t	2026-02-12 12:09:52.261308	2026-02-20 11:49:01.407691	2026-02-20 11:49:01.407691
\.


--
-- Name: aprobaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.aprobaciones_id_seq', 1, true);


--
-- Name: archivos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.archivos_id_seq', 15, true);


--
-- Name: codigos_verificacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.codigos_verificacion_id_seq', 29, true);


--
-- Name: comentarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.comentarios_id_seq', 44, true);


--
-- Name: comentarios_reevaluacion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.comentarios_reevaluacion_id_seq', 2, true);


--
-- Name: conocimiento_articulos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.conocimiento_articulos_id_seq', 2, true);


--
-- Name: conocimiento_categorias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.conocimiento_categorias_id_seq', 5, true);


--
-- Name: cronograma_tareas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.cronograma_tareas_id_seq', 88, true);


--
-- Name: cronogramas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.cronogramas_id_seq', 18, true);


--
-- Name: estimaciones_costo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.estimaciones_costo_id_seq', 4, true);


--
-- Name: evaluacion_asignaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.evaluacion_asignaciones_id_seq', 7, true);


--
-- Name: evaluaciones_nt_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.evaluaciones_nt_id_seq', 7, true);


--
-- Name: festivos_colombia_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.festivos_colombia_id_seq', 108, true);


--
-- Name: historial_cambios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.historial_cambios_id_seq', 83, true);


--
-- Name: notificaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.notificaciones_id_seq', 148, true);


--
-- Name: opciones_formulario_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.opciones_formulario_id_seq', 47, true);


--
-- Name: proyecto_miembros_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.proyecto_miembros_id_seq', 1, false);


--
-- Name: proyecto_pausas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.proyecto_pausas_id_seq', 1, false);


--
-- Name: proyecto_tareas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.proyecto_tareas_id_seq', 1, false);


--
-- Name: proyectos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.proyectos_id_seq', 3, true);


--
-- Name: reportes_semanales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.reportes_semanales_id_seq', 1, false);


--
-- Name: respuestas_pendientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.respuestas_pendientes_id_seq', 1, true);


--
-- Name: sesiones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.sesiones_id_seq', 134, true);


--
-- Name: sesiones_solicitante_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.sesiones_solicitante_id_seq', 42, true);


--
-- Name: solicitantes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.solicitantes_id_seq', 42, true);


--
-- Name: solicitudes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.solicitudes_id_seq', 36, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.tickets_id_seq', 30, true);


--
-- Name: transferencias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.transferencias_id_seq', 10, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: soldev_user
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 10, true);


--
-- Name: aprobaciones aprobaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.aprobaciones
    ADD CONSTRAINT aprobaciones_pkey PRIMARY KEY (id);


--
-- Name: archivos archivos_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_pkey PRIMARY KEY (id);


--
-- Name: codigos_verificacion codigos_verificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.codigos_verificacion
    ADD CONSTRAINT codigos_verificacion_pkey PRIMARY KEY (id);


--
-- Name: comentarios comentarios_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_pkey PRIMARY KEY (id);


--
-- Name: comentarios_reevaluacion comentarios_reevaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios_reevaluacion
    ADD CONSTRAINT comentarios_reevaluacion_pkey PRIMARY KEY (id);


--
-- Name: conocimiento_articulos conocimiento_articulos_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_articulos
    ADD CONSTRAINT conocimiento_articulos_pkey PRIMARY KEY (id);


--
-- Name: conocimiento_articulos conocimiento_articulos_slug_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_articulos
    ADD CONSTRAINT conocimiento_articulos_slug_key UNIQUE (slug);


--
-- Name: conocimiento_categorias conocimiento_categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_categorias
    ADD CONSTRAINT conocimiento_categorias_pkey PRIMARY KEY (id);


--
-- Name: cronograma_tareas cronograma_tareas_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronograma_tareas
    ADD CONSTRAINT cronograma_tareas_pkey PRIMARY KEY (id);


--
-- Name: cronogramas cronogramas_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronogramas
    ADD CONSTRAINT cronogramas_pkey PRIMARY KEY (id);


--
-- Name: estimaciones_costo estimaciones_costo_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.estimaciones_costo
    ADD CONSTRAINT estimaciones_costo_pkey PRIMARY KEY (id);


--
-- Name: evaluacion_asignaciones evaluacion_asignaciones_evaluacion_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluacion_asignaciones
    ADD CONSTRAINT evaluacion_asignaciones_evaluacion_id_usuario_id_key UNIQUE (evaluacion_id, usuario_id);


--
-- Name: evaluacion_asignaciones evaluacion_asignaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluacion_asignaciones
    ADD CONSTRAINT evaluacion_asignaciones_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones_nt evaluaciones_nt_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluaciones_nt
    ADD CONSTRAINT evaluaciones_nt_pkey PRIMARY KEY (id);


--
-- Name: festivos_colombia festivos_colombia_fecha_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.festivos_colombia
    ADD CONSTRAINT festivos_colombia_fecha_key UNIQUE (fecha);


--
-- Name: festivos_colombia festivos_colombia_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.festivos_colombia
    ADD CONSTRAINT festivos_colombia_pkey PRIMARY KEY (id);


--
-- Name: historial_cambios historial_cambios_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.historial_cambios
    ADD CONSTRAINT historial_cambios_pkey PRIMARY KEY (id);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id);


--
-- Name: opciones_formulario opciones_formulario_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.opciones_formulario
    ADD CONSTRAINT opciones_formulario_pkey PRIMARY KEY (id);


--
-- Name: proyecto_miembros proyecto_miembros_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_miembros
    ADD CONSTRAINT proyecto_miembros_pkey PRIMARY KEY (id);


--
-- Name: proyecto_miembros proyecto_miembros_proyecto_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_miembros
    ADD CONSTRAINT proyecto_miembros_proyecto_id_usuario_id_key UNIQUE (proyecto_id, usuario_id);


--
-- Name: proyecto_pausas proyecto_pausas_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_pausas
    ADD CONSTRAINT proyecto_pausas_pkey PRIMARY KEY (id);


--
-- Name: proyecto_tareas proyecto_tareas_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_tareas
    ADD CONSTRAINT proyecto_tareas_pkey PRIMARY KEY (id);


--
-- Name: proyectos proyectos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_codigo_key UNIQUE (codigo);


--
-- Name: proyectos proyectos_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_pkey PRIMARY KEY (id);


--
-- Name: reportes_semanales reportes_semanales_fecha_inicio_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.reportes_semanales
    ADD CONSTRAINT reportes_semanales_fecha_inicio_key UNIQUE (fecha_inicio);


--
-- Name: reportes_semanales reportes_semanales_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.reportes_semanales
    ADD CONSTRAINT reportes_semanales_pkey PRIMARY KEY (id);


--
-- Name: respuestas_pendientes respuestas_pendientes_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.respuestas_pendientes
    ADD CONSTRAINT respuestas_pendientes_pkey PRIMARY KEY (id);


--
-- Name: respuestas_pendientes respuestas_pendientes_token_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.respuestas_pendientes
    ADD CONSTRAINT respuestas_pendientes_token_key UNIQUE (token);


--
-- Name: sesiones sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_pkey PRIMARY KEY (id);


--
-- Name: sesiones_solicitante sesiones_solicitante_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones_solicitante
    ADD CONSTRAINT sesiones_solicitante_pkey PRIMARY KEY (id);


--
-- Name: sesiones_solicitante sesiones_solicitante_token_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones_solicitante
    ADD CONSTRAINT sesiones_solicitante_token_key UNIQUE (token);


--
-- Name: sesiones sesiones_token_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_token_key UNIQUE (token);


--
-- Name: solicitantes solicitantes_email_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitantes
    ADD CONSTRAINT solicitantes_email_key UNIQUE (email);


--
-- Name: solicitantes solicitantes_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitantes
    ADD CONSTRAINT solicitantes_pkey PRIMARY KEY (id);


--
-- Name: solicitudes solicitudes_codigo_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_codigo_key UNIQUE (codigo);


--
-- Name: solicitudes solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_codigo_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_codigo_key UNIQUE (codigo);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: transferencias transferencias_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: idx_archivos_entidad; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_archivos_entidad ON public.archivos USING btree (entidad_tipo, entidad_id);


--
-- Name: idx_articulos_categoria; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_articulos_categoria ON public.conocimiento_articulos USING btree (categoria_id);


--
-- Name: idx_articulos_etiquetas; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_articulos_etiquetas ON public.conocimiento_articulos USING gin (etiquetas);


--
-- Name: idx_articulos_publicado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_articulos_publicado ON public.conocimiento_articulos USING btree (publicado);


--
-- Name: idx_articulos_slug; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_articulos_slug ON public.conocimiento_articulos USING btree (slug);


--
-- Name: idx_articulos_titulo_trgm; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_articulos_titulo_trgm ON public.conocimiento_articulos USING gin (titulo public.gin_trgm_ops);


--
-- Name: idx_asignaciones_evaluacion; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_asignaciones_evaluacion ON public.evaluacion_asignaciones USING btree (evaluacion_id);


--
-- Name: idx_asignaciones_usuario; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_asignaciones_usuario ON public.evaluacion_asignaciones USING btree (usuario_id);


--
-- Name: idx_codigos_email; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_codigos_email ON public.codigos_verificacion USING btree (email);


--
-- Name: idx_codigos_expira; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_codigos_expira ON public.codigos_verificacion USING btree (expira_en);


--
-- Name: idx_comentarios_entidad; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_comentarios_entidad ON public.comentarios USING btree (entidad_tipo, entidad_id);


--
-- Name: idx_comentarios_usuario; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_comentarios_usuario ON public.comentarios USING btree (usuario_id);


--
-- Name: idx_cronograma_tareas_asignado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_cronograma_tareas_asignado ON public.cronograma_tareas USING btree (asignado_id);


--
-- Name: idx_cronograma_tareas_asignados; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_cronograma_tareas_asignados ON public.cronograma_tareas USING gin (asignados_ids);


--
-- Name: idx_cronograma_tareas_cronograma; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_cronograma_tareas_cronograma ON public.cronograma_tareas USING btree (cronograma_id);


--
-- Name: idx_cronograma_tareas_fechas; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_cronograma_tareas_fechas ON public.cronograma_tareas USING btree (fecha_inicio, fecha_fin);


--
-- Name: idx_cronogramas_evaluacion; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_cronogramas_evaluacion ON public.cronogramas USING btree (evaluacion_id);


--
-- Name: idx_cronogramas_solicitud; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_cronogramas_solicitud ON public.cronogramas USING btree (solicitud_id);


--
-- Name: idx_estimaciones_evaluacion; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_estimaciones_evaluacion ON public.estimaciones_costo USING btree (evaluacion_id);


--
-- Name: idx_evaluaciones_estado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_evaluaciones_estado ON public.evaluaciones_nt USING btree (estado);


--
-- Name: idx_evaluaciones_evaluador; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_evaluaciones_evaluador ON public.evaluaciones_nt USING btree (evaluador_id);


--
-- Name: idx_evaluaciones_solicitud; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_evaluaciones_solicitud ON public.evaluaciones_nt USING btree (solicitud_id);


--
-- Name: idx_festivos_ano; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_festivos_ano ON public.festivos_colombia USING btree (ano);


--
-- Name: idx_festivos_fecha; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_festivos_fecha ON public.festivos_colombia USING btree (fecha);


--
-- Name: idx_historial_creado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_historial_creado ON public.historial_cambios USING btree (creado_en);


--
-- Name: idx_historial_entidad; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_historial_entidad ON public.historial_cambios USING btree (entidad_tipo, entidad_id);


--
-- Name: idx_historial_usuario; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_historial_usuario ON public.historial_cambios USING btree (usuario_id);


--
-- Name: idx_notificaciones_leida; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_notificaciones_leida ON public.notificaciones USING btree (leida);


--
-- Name: idx_notificaciones_usuario; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_notificaciones_usuario ON public.notificaciones USING btree (usuario_id);


--
-- Name: idx_opciones_categoria; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_opciones_categoria ON public.opciones_formulario USING btree (categoria, activo);


--
-- Name: idx_opciones_padre; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_opciones_padre ON public.opciones_formulario USING btree (padre_id);


--
-- Name: idx_proyecto_pausas_activa; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_proyecto_pausas_activa ON public.proyecto_pausas USING btree (solicitud_id) WHERE (fecha_fin IS NULL);


--
-- Name: idx_proyecto_pausas_solicitud; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_proyecto_pausas_solicitud ON public.proyecto_pausas USING btree (solicitud_id);


--
-- Name: idx_proyectos_codigo; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_proyectos_codigo ON public.proyectos USING btree (codigo);


--
-- Name: idx_proyectos_estado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_proyectos_estado ON public.proyectos USING btree (estado);


--
-- Name: idx_proyectos_responsable; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_proyectos_responsable ON public.proyectos USING btree (responsable_id);


--
-- Name: idx_proyectos_solicitud; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_proyectos_solicitud ON public.proyectos USING btree (solicitud_id);


--
-- Name: idx_reevaluacion_evaluacion; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_reevaluacion_evaluacion ON public.comentarios_reevaluacion USING btree (evaluacion_id);


--
-- Name: idx_reevaluacion_gerente; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_reevaluacion_gerente ON public.comentarios_reevaluacion USING btree (gerente_id);


--
-- Name: idx_reevaluacion_solicitud; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_reevaluacion_solicitud ON public.comentarios_reevaluacion USING btree (solicitud_id);


--
-- Name: idx_respuestas_expira; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_respuestas_expira ON public.respuestas_pendientes USING btree (expira_en);


--
-- Name: idx_respuestas_token; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_respuestas_token ON public.respuestas_pendientes USING btree (token);


--
-- Name: idx_sesiones_activa; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_sesiones_activa ON public.sesiones USING btree (activa);


--
-- Name: idx_sesiones_expira; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_sesiones_expira ON public.sesiones USING btree (expira_en);


--
-- Name: idx_sesiones_token; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_sesiones_token ON public.sesiones USING btree (token);


--
-- Name: idx_sesiones_usuario; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_sesiones_usuario ON public.sesiones USING btree (usuario_id);


--
-- Name: idx_solicitantes_email; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitantes_email ON public.solicitantes USING btree (email);


--
-- Name: idx_solicitudes_codigo; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_codigo ON public.solicitudes USING btree (codigo);


--
-- Name: idx_solicitudes_creado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_creado ON public.solicitudes USING btree (creado_en);


--
-- Name: idx_solicitudes_estado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_estado ON public.solicitudes USING btree (estado);


--
-- Name: idx_solicitudes_evaluador; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_evaluador ON public.solicitudes USING btree (evaluador_id);


--
-- Name: idx_solicitudes_fecha_creacion; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_fecha_creacion ON public.solicitudes USING btree (creado_en);


--
-- Name: idx_solicitudes_prioridad; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_prioridad ON public.solicitudes USING btree (prioridad);


--
-- Name: idx_solicitudes_solicitante; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_solicitante ON public.solicitudes USING btree (solicitante_id);


--
-- Name: idx_solicitudes_tipo; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_tipo ON public.solicitudes USING btree (tipo);


--
-- Name: idx_solicitudes_titulo_trgm; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_solicitudes_titulo_trgm ON public.solicitudes USING gin (titulo public.gin_trgm_ops);


--
-- Name: idx_tareas_asignado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tareas_asignado ON public.proyecto_tareas USING btree (asignado_id);


--
-- Name: idx_tareas_fechas; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tareas_fechas ON public.proyecto_tareas USING btree (fecha_inicio, fecha_fin);


--
-- Name: idx_tareas_proyecto; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tareas_proyecto ON public.proyecto_tareas USING btree (proyecto_id);


--
-- Name: idx_tickets_asignado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_asignado ON public.tickets USING btree (asignado_id);


--
-- Name: idx_tickets_categoria; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_categoria ON public.tickets USING btree (categoria);


--
-- Name: idx_tickets_codigo; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_codigo ON public.tickets USING btree (codigo);


--
-- Name: idx_tickets_creado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_creado ON public.tickets USING btree (creado_en);


--
-- Name: idx_tickets_estado; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_estado ON public.tickets USING btree (estado);


--
-- Name: idx_tickets_fecha_creacion; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_fecha_creacion ON public.tickets USING btree (creado_en);


--
-- Name: idx_tickets_prioridad; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_prioridad ON public.tickets USING btree (prioridad);


--
-- Name: idx_tickets_solicitante; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_tickets_solicitante ON public.tickets USING btree (solicitante_id);


--
-- Name: idx_transferencias_codigo_destino; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_transferencias_codigo_destino ON public.transferencias USING btree (destino_codigo);


--
-- Name: idx_transferencias_codigo_origen; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_transferencias_codigo_origen ON public.transferencias USING btree (origen_codigo);


--
-- Name: idx_transferencias_destino; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_transferencias_destino ON public.transferencias USING btree (destino_tipo, destino_id);


--
-- Name: idx_transferencias_origen; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_transferencias_origen ON public.transferencias USING btree (origen_tipo, origen_id);


--
-- Name: idx_usuarios_activo; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_usuarios_activo ON public.usuarios USING btree (activo);


--
-- Name: idx_usuarios_email; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: soldev_user
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (rol);


--
-- Name: cronogramas cronogramas_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER cronogramas_timestamp BEFORE UPDATE ON public.cronogramas FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: estimaciones_costo estimaciones_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER estimaciones_timestamp BEFORE UPDATE ON public.estimaciones_costo FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: evaluaciones_nt evaluaciones_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER evaluaciones_timestamp BEFORE UPDATE ON public.evaluaciones_nt FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: opciones_formulario opciones_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER opciones_timestamp BEFORE UPDATE ON public.opciones_formulario FOR EACH ROW EXECUTE FUNCTION public.update_opciones_timestamp();


--
-- Name: conocimiento_articulos update_articulos_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER update_articulos_timestamp BEFORE UPDATE ON public.conocimiento_articulos FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: proyectos update_proyectos_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER update_proyectos_timestamp BEFORE UPDATE ON public.proyectos FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: solicitudes update_solicitudes_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER update_solicitudes_timestamp BEFORE UPDATE ON public.solicitudes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: proyecto_tareas update_tareas_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER update_tareas_timestamp BEFORE UPDATE ON public.proyecto_tareas FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: tickets update_tickets_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER update_tickets_timestamp BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: usuarios update_usuarios_timestamp; Type: TRIGGER; Schema: public; Owner: soldev_user
--

CREATE TRIGGER update_usuarios_timestamp BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: aprobaciones aprobaciones_aprobador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.aprobaciones
    ADD CONSTRAINT aprobaciones_aprobador_id_fkey FOREIGN KEY (aprobador_id) REFERENCES public.usuarios(id);


--
-- Name: aprobaciones aprobaciones_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.aprobaciones
    ADD CONSTRAINT aprobaciones_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes(id) ON DELETE CASCADE;


--
-- Name: archivos archivos_comentario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_comentario_id_fkey FOREIGN KEY (comentario_id) REFERENCES public.comentarios(id) ON DELETE SET NULL;


--
-- Name: archivos archivos_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.archivos
    ADD CONSTRAINT archivos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.usuarios(id);


--
-- Name: comentarios_reevaluacion comentarios_reevaluacion_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios_reevaluacion
    ADD CONSTRAINT comentarios_reevaluacion_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones_nt(id);


--
-- Name: comentarios_reevaluacion comentarios_reevaluacion_gerente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios_reevaluacion
    ADD CONSTRAINT comentarios_reevaluacion_gerente_id_fkey FOREIGN KEY (gerente_id) REFERENCES public.usuarios(id);


--
-- Name: comentarios_reevaluacion comentarios_reevaluacion_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios_reevaluacion
    ADD CONSTRAINT comentarios_reevaluacion_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes(id) ON DELETE CASCADE;


--
-- Name: comentarios comentarios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: conocimiento_articulos conocimiento_articulos_autor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_articulos
    ADD CONSTRAINT conocimiento_articulos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES public.usuarios(id);


--
-- Name: conocimiento_articulos conocimiento_articulos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.conocimiento_articulos
    ADD CONSTRAINT conocimiento_articulos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.conocimiento_categorias(id);


--
-- Name: cronograma_tareas cronograma_tareas_asignado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronograma_tareas
    ADD CONSTRAINT cronograma_tareas_asignado_id_fkey FOREIGN KEY (asignado_id) REFERENCES public.usuarios(id);


--
-- Name: cronograma_tareas cronograma_tareas_cronograma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronograma_tareas
    ADD CONSTRAINT cronograma_tareas_cronograma_id_fkey FOREIGN KEY (cronograma_id) REFERENCES public.cronogramas(id) ON DELETE CASCADE;


--
-- Name: cronogramas cronogramas_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronogramas
    ADD CONSTRAINT cronogramas_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones_nt(id) ON DELETE CASCADE;


--
-- Name: cronogramas cronogramas_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.cronogramas
    ADD CONSTRAINT cronogramas_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes(id);


--
-- Name: estimaciones_costo estimaciones_costo_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.estimaciones_costo
    ADD CONSTRAINT estimaciones_costo_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones_nt(id) ON DELETE CASCADE;


--
-- Name: evaluacion_asignaciones evaluacion_asignaciones_evaluacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluacion_asignaciones
    ADD CONSTRAINT evaluacion_asignaciones_evaluacion_id_fkey FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones_nt(id) ON DELETE CASCADE;


--
-- Name: evaluacion_asignaciones evaluacion_asignaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluacion_asignaciones
    ADD CONSTRAINT evaluacion_asignaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: evaluaciones_nt evaluaciones_nt_evaluador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluaciones_nt
    ADD CONSTRAINT evaluaciones_nt_evaluador_id_fkey FOREIGN KEY (evaluador_id) REFERENCES public.usuarios(id);


--
-- Name: evaluaciones_nt evaluaciones_nt_lider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluaciones_nt
    ADD CONSTRAINT evaluaciones_nt_lider_id_fkey FOREIGN KEY (lider_id) REFERENCES public.usuarios(id);


--
-- Name: evaluaciones_nt evaluaciones_nt_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.evaluaciones_nt
    ADD CONSTRAINT evaluaciones_nt_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes(id) ON DELETE CASCADE;


--
-- Name: historial_cambios historial_cambios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.historial_cambios
    ADD CONSTRAINT historial_cambios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- Name: notificaciones notificaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: opciones_formulario opciones_formulario_padre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.opciones_formulario
    ADD CONSTRAINT opciones_formulario_padre_id_fkey FOREIGN KEY (padre_id) REFERENCES public.opciones_formulario(id) ON DELETE CASCADE;


--
-- Name: proyecto_miembros proyecto_miembros_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_miembros
    ADD CONSTRAINT proyecto_miembros_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id) ON DELETE CASCADE;


--
-- Name: proyecto_miembros proyecto_miembros_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_miembros
    ADD CONSTRAINT proyecto_miembros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: proyecto_pausas proyecto_pausas_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_pausas
    ADD CONSTRAINT proyecto_pausas_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.usuarios(id);


--
-- Name: proyecto_pausas proyecto_pausas_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_pausas
    ADD CONSTRAINT proyecto_pausas_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes(id) ON DELETE CASCADE;


--
-- Name: proyecto_tareas proyecto_tareas_asignado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_tareas
    ADD CONSTRAINT proyecto_tareas_asignado_id_fkey FOREIGN KEY (asignado_id) REFERENCES public.usuarios(id);


--
-- Name: proyecto_tareas proyecto_tareas_proyecto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyecto_tareas
    ADD CONSTRAINT proyecto_tareas_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.proyectos(id) ON DELETE CASCADE;


--
-- Name: proyectos proyectos_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.usuarios(id);


--
-- Name: proyectos proyectos_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.proyectos
    ADD CONSTRAINT proyectos_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes(id);


--
-- Name: respuestas_pendientes respuestas_pendientes_comentario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.respuestas_pendientes
    ADD CONSTRAINT respuestas_pendientes_comentario_id_fkey FOREIGN KEY (comentario_id) REFERENCES public.comentarios(id) ON DELETE CASCADE;


--
-- Name: respuestas_pendientes respuestas_pendientes_usuario_pregunta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.respuestas_pendientes
    ADD CONSTRAINT respuestas_pendientes_usuario_pregunta_id_fkey FOREIGN KEY (usuario_pregunta_id) REFERENCES public.usuarios(id);


--
-- Name: sesiones_solicitante sesiones_solicitante_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones_solicitante
    ADD CONSTRAINT sesiones_solicitante_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id) ON DELETE CASCADE;


--
-- Name: sesiones sesiones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.sesiones
    ADD CONSTRAINT sesiones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: solicitudes solicitudes_cancelado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_cancelado_por_fkey FOREIGN KEY (cancelado_por) REFERENCES public.usuarios(id);


--
-- Name: solicitudes solicitudes_evaluador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_evaluador_id_fkey FOREIGN KEY (evaluador_id) REFERENCES public.usuarios(id);


--
-- Name: solicitudes solicitudes_origen_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_origen_ticket_id_fkey FOREIGN KEY (origen_ticket_id) REFERENCES public.tickets(id);


--
-- Name: solicitudes solicitudes_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id);


--
-- Name: solicitudes solicitudes_transferido_a_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_transferido_a_ticket_id_fkey FOREIGN KEY (transferido_a_ticket_id) REFERENCES public.tickets(id);


--
-- Name: solicitudes solicitudes_usuario_creador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.solicitudes
    ADD CONSTRAINT solicitudes_usuario_creador_id_fkey FOREIGN KEY (usuario_creador_id) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_asignado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_asignado_id_fkey FOREIGN KEY (asignado_id) REFERENCES public.usuarios(id);


--
-- Name: tickets tickets_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.solicitantes(id);


--
-- Name: tickets tickets_transferido_a_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_transferido_a_solicitud_id_fkey FOREIGN KEY (transferido_a_solicitud_id) REFERENCES public.solicitudes(id);


--
-- Name: tickets tickets_usuario_creador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_usuario_creador_id_fkey FOREIGN KEY (usuario_creador_id) REFERENCES public.usuarios(id);


--
-- Name: transferencias transferencias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: soldev_user
--

ALTER TABLE ONLY public.transferencias
    ADD CONSTRAINT transferencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict MdohZ2oLf4PdhdctOuXCugxBNYIX6Cfa1miwl8jOROHFhkwEKyokA5g7TeeLQYk

