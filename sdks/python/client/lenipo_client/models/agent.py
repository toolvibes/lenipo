from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.agent_status import AgentStatus
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="Agent")



@_attrs_define
class Agent:
    """ 
        Attributes:
            id (UUID):
            display_name (str):
            vendor (str):
            model (str):
            owner (None | UserRef):
            status (AgentStatus):
            created_at (datetime.datetime):
     """

    id: UUID
    display_name: str
    vendor: str
    model: str
    owner: None | UserRef
    status: AgentStatus
    created_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        display_name = self.display_name

        vendor = self.vendor

        model = self.model

        owner: dict[str, Any] | None
        if isinstance(self.owner, UserRef):
            owner = self.owner.to_dict()
        else:
            owner = self.owner

        status = self.status.value

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "displayName": display_name,
            "vendor": vendor,
            "model": model,
            "owner": owner,
            "status": status,
            "createdAt": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        display_name = d.pop("displayName")

        vendor = d.pop("vendor")

        model = d.pop("model")

        def _parse_owner(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                owner_type_0 = UserRef.from_dict(data)



                return owner_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        owner = _parse_owner(d.pop("owner"))


        status = AgentStatus(d.pop("status"))




        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        agent = cls(
            id=id,
            display_name=display_name,
            vendor=vendor,
            model=model,
            owner=owner,
            status=status,
            created_at=created_at,
        )

        return agent

