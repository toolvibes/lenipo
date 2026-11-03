from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.setup_request_admin import SetupRequestAdmin





T = TypeVar("T", bound="SetupRequest")



@_attrs_define
class SetupRequest:
    """ 
        Attributes:
            token (str):
            instance_name (str):
            admin (SetupRequestAdmin):
     """

    token: str
    instance_name: str
    admin: SetupRequestAdmin
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.setup_request_admin import SetupRequestAdmin # noqa: PLC0415
        token = self.token

        instance_name = self.instance_name

        admin = self.admin.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "token": token,
            "instanceName": instance_name,
            "admin": admin,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.setup_request_admin import SetupRequestAdmin # noqa: PLC0415
        d = dict(src_dict)
        token = d.pop("token")

        instance_name = d.pop("instanceName")

        admin = SetupRequestAdmin.from_dict(d.pop("admin"))




        setup_request = cls(
            token=token,
            instance_name=instance_name,
            admin=admin,
        )


        setup_request.additional_properties = d
        return setup_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
