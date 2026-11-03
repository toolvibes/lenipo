from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.global_permission import GlobalPermission
from ..models.me_authenticated_via import MeAuthenticatedVia
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.two_factor_status import TwoFactorStatus





T = TypeVar("T", bound="Me")



@_attrs_define
class Me:
    """ 
        Attributes:
            id (UUID):
            email (str):
            display_name (str):
            locale (str):
            time_zone (str):
            global_permissions (list[GlobalPermission]):
            authenticated_via (MeAuthenticatedVia):
            onboarded (bool):
            keyboard_shortcuts (bool):
            has_password (bool):
            two_factor (TwoFactorStatus):
     """

    id: UUID
    email: str
    display_name: str
    locale: str
    time_zone: str
    global_permissions: list[GlobalPermission]
    authenticated_via: MeAuthenticatedVia
    onboarded: bool
    keyboard_shortcuts: bool
    has_password: bool
    two_factor: TwoFactorStatus





    def to_dict(self) -> dict[str, Any]:
        from ..models.two_factor_status import TwoFactorStatus # noqa: PLC0415
        id = str(self.id)

        email = self.email

        display_name = self.display_name

        locale = self.locale

        time_zone = self.time_zone

        global_permissions = []
        for global_permissions_item_data in self.global_permissions:
            global_permissions_item = global_permissions_item_data.value
            global_permissions.append(global_permissions_item)



        authenticated_via = self.authenticated_via.value

        onboarded = self.onboarded

        keyboard_shortcuts = self.keyboard_shortcuts

        has_password = self.has_password

        two_factor = self.two_factor.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "email": email,
            "displayName": display_name,
            "locale": locale,
            "timeZone": time_zone,
            "globalPermissions": global_permissions,
            "authenticatedVia": authenticated_via,
            "onboarded": onboarded,
            "keyboardShortcuts": keyboard_shortcuts,
            "hasPassword": has_password,
            "twoFactor": two_factor,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.two_factor_status import TwoFactorStatus # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        display_name = d.pop("displayName")

        locale = d.pop("locale")

        time_zone = d.pop("timeZone")

        global_permissions = []
        _global_permissions = d.pop("globalPermissions")
        for global_permissions_item_data in (_global_permissions):
            global_permissions_item = GlobalPermission(global_permissions_item_data)



            global_permissions.append(global_permissions_item)


        authenticated_via = MeAuthenticatedVia(d.pop("authenticatedVia"))




        onboarded = d.pop("onboarded")

        keyboard_shortcuts = d.pop("keyboardShortcuts")

        has_password = d.pop("hasPassword")

        two_factor = TwoFactorStatus.from_dict(d.pop("twoFactor"))




        me = cls(
            id=id,
            email=email,
            display_name=display_name,
            locale=locale,
            time_zone=time_zone,
            global_permissions=global_permissions,
            authenticated_via=authenticated_via,
            onboarded=onboarded,
            keyboard_shortcuts=keyboard_shortcuts,
            has_password=has_password,
            two_factor=two_factor,
        )

        return me

