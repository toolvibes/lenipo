from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.service_customer_group_type_0 import ServiceCustomerGroupType0
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ServiceCustomer")



@_attrs_define
class ServiceCustomer:
    """ 
        Attributes:
            id (UUID):
            user (None | UserRef):
            group (None | ServiceCustomerGroupType0):
     """

    id: UUID
    user: None | UserRef
    group: None | ServiceCustomerGroupType0





    def to_dict(self) -> dict[str, Any]:
        from ..models.service_customer_group_type_0 import ServiceCustomerGroupType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        user: dict[str, Any] | None
        if isinstance(self.user, UserRef):
            user = self.user.to_dict()
        else:
            user = self.user

        group: dict[str, Any] | None
        if isinstance(self.group, ServiceCustomerGroupType0):
            group = self.group.to_dict()
        else:
            group = self.group


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "user": user,
            "group": group,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.service_customer_group_type_0 import ServiceCustomerGroupType0 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        def _parse_user(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                user_type_0 = UserRef.from_dict(data)



                return user_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        user = _parse_user(d.pop("user"))


        def _parse_group(data: object) -> None | ServiceCustomerGroupType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                group_type_0 = ServiceCustomerGroupType0.from_dict(data)



                return group_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | ServiceCustomerGroupType0, data)

        group = _parse_group(d.pop("group"))


        service_customer = cls(
            id=id,
            user=user,
            group=group,
        )

        return service_customer

