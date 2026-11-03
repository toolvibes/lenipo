from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.token_scope import TokenScope
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.installed_app_modules import InstalledAppModules





T = TypeVar("T", bound="InstalledApp")



@_attrs_define
class InstalledApp:
    """ 
        Attributes:
            id (UUID):
            key (str):
            name (str):
            vendor (str):
            origin (str):
            uses_api (bool):
            modules (InstalledAppModules):
            manifest_url (str):
            description (str):
            scopes (list[TokenScope]):
            enabled (bool):
            installed_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    key: str
    name: str
    vendor: str
    origin: str
    uses_api: bool
    modules: InstalledAppModules
    manifest_url: str
    description: str
    scopes: list[TokenScope]
    enabled: bool
    installed_at: datetime.datetime
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.installed_app_modules import InstalledAppModules # noqa: PLC0415
        id = str(self.id)

        key = self.key

        name = self.name

        vendor = self.vendor

        origin = self.origin

        uses_api = self.uses_api

        modules = self.modules.to_dict()

        manifest_url = self.manifest_url

        description = self.description

        scopes = []
        for scopes_item_data in self.scopes:
            scopes_item = scopes_item_data.value
            scopes.append(scopes_item)



        enabled = self.enabled

        installed_at = self.installed_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "key": key,
            "name": name,
            "vendor": vendor,
            "origin": origin,
            "usesApi": uses_api,
            "modules": modules,
            "manifestUrl": manifest_url,
            "description": description,
            "scopes": scopes,
            "enabled": enabled,
            "installedAt": installed_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.installed_app_modules import InstalledAppModules # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        key = d.pop("key")

        name = d.pop("name")

        vendor = d.pop("vendor")

        origin = d.pop("origin")

        uses_api = d.pop("usesApi")

        modules = InstalledAppModules.from_dict(d.pop("modules"))




        manifest_url = d.pop("manifestUrl")

        description = d.pop("description")

        scopes = []
        _scopes = d.pop("scopes")
        for scopes_item_data in (_scopes):
            scopes_item = TokenScope(scopes_item_data)



            scopes.append(scopes_item)


        enabled = d.pop("enabled")

        installed_at = datetime.datetime.fromisoformat(d.pop("installedAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        installed_app = cls(
            id=id,
            key=key,
            name=name,
            vendor=vendor,
            origin=origin,
            uses_api=uses_api,
            modules=modules,
            manifest_url=manifest_url,
            description=description,
            scopes=scopes,
            enabled=enabled,
            installed_at=installed_at,
            updated_at=updated_at,
        )

        return installed_app

