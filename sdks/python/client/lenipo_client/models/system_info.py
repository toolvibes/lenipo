from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.system_info_mode import SystemInfoMode
from typing import cast
import datetime






T = TypeVar("T", bound="SystemInfo")



@_attrs_define
class SystemInfo:
    """ 
        Attributes:
            version (str):
            mode (SystemInfoMode):
            started_at (datetime.datetime):
            uptime_seconds (int):
            node_version (str):
            postgres_version (str):
            migrations_applied (int):
            users (int):
            oidc_enabled (bool):
     """

    version: str
    mode: SystemInfoMode
    started_at: datetime.datetime
    uptime_seconds: int
    node_version: str
    postgres_version: str
    migrations_applied: int
    users: int
    oidc_enabled: bool





    def to_dict(self) -> dict[str, Any]:
        version = self.version

        mode = self.mode.value

        started_at = self.started_at.isoformat()

        uptime_seconds = self.uptime_seconds

        node_version = self.node_version

        postgres_version = self.postgres_version

        migrations_applied = self.migrations_applied

        users = self.users

        oidc_enabled = self.oidc_enabled


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "version": version,
            "mode": mode,
            "startedAt": started_at,
            "uptimeSeconds": uptime_seconds,
            "nodeVersion": node_version,
            "postgresVersion": postgres_version,
            "migrationsApplied": migrations_applied,
            "users": users,
            "oidcEnabled": oidc_enabled,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        version = d.pop("version")

        mode = SystemInfoMode(d.pop("mode"))




        started_at = datetime.datetime.fromisoformat(d.pop("startedAt"))




        uptime_seconds = d.pop("uptimeSeconds")

        node_version = d.pop("nodeVersion")

        postgres_version = d.pop("postgresVersion")

        migrations_applied = d.pop("migrationsApplied")

        users = d.pop("users")

        oidc_enabled = d.pop("oidcEnabled")

        system_info = cls(
            version=version,
            mode=mode,
            started_at=started_at,
            uptime_seconds=uptime_seconds,
            node_version=node_version,
            postgres_version=postgres_version,
            migrations_applied=migrations_applied,
            users=users,
            oidc_enabled=oidc_enabled,
        )

        return system_info

