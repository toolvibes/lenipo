from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.app_manifest_scopes_item import AppManifestScopesItem
from typing import cast

if TYPE_CHECKING:
  from ..models.app_manifest_modules import AppManifestModules





T = TypeVar("T", bound="AppManifest")



@_attrs_define
class AppManifest:
    """ 
        Attributes:
            key (str):
            name (str):
            vendor (str):  Default: ''.
            description (str):  Default: ''.
            base_url (str):
            scopes (list[AppManifestScopesItem]):
            modules (AppManifestModules):
     """

    key: str
    name: str
    base_url: str
    scopes: list[AppManifestScopesItem]
    modules: AppManifestModules
    vendor: str = ''
    description: str = ''





    def to_dict(self) -> dict[str, Any]:
        from ..models.app_manifest_modules import AppManifestModules # noqa: PLC0415
        key = self.key

        name = self.name

        vendor = self.vendor

        description = self.description

        base_url = self.base_url

        scopes = []
        for scopes_item_data in self.scopes:
            scopes_item = scopes_item_data.value
            scopes.append(scopes_item)



        modules = self.modules.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "vendor": vendor,
            "description": description,
            "baseUrl": base_url,
            "scopes": scopes,
            "modules": modules,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.app_manifest_modules import AppManifestModules # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        vendor = d.pop("vendor")

        description = d.pop("description")

        base_url = d.pop("baseUrl")

        scopes = []
        _scopes = d.pop("scopes")
        for scopes_item_data in (_scopes):
            scopes_item = AppManifestScopesItem(scopes_item_data)



            scopes.append(scopes_item)


        modules = AppManifestModules.from_dict(d.pop("modules"))




        app_manifest = cls(
            key=key,
            name=name,
            vendor=vendor,
            description=description,
            base_url=base_url,
            scopes=scopes,
            modules=modules,
        )

        return app_manifest

